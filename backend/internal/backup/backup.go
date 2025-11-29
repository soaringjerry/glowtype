package backup

import (
	"errors"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"golang.org/x/sys/unix"
	"gorm.io/gorm"
)

// Config controls the background backup scheduler.
type Config struct {
	Enabled       bool
	DBPath        string
	BackupDir     string
	Interval      time.Duration
	MaxTotalBytes int64
	MinFreeBytes  int64
}

// Start launches a background ticker to back up the SQLite database.
func Start(cfg Config, db *gorm.DB) {
	if !cfg.Enabled {
		log.Printf("Database backup scheduler disabled via BACKUP_ENABLED=0")
		return
	}
	if db == nil {
		log.Printf("Database backup scheduler not started: database handle is nil")
		return
	}
	if cfg.DBPath == "" || cfg.BackupDir == "" {
		log.Printf("Database backup scheduler not started: DB_PATH or BACKUP_DIR is empty")
		return
	}
	if cfg.Interval <= 0 {
		cfg.Interval = time.Hour
	}

	go func() {
		if err := performBackup(cfg, db); err != nil {
			log.Printf("Initial database backup failed: %v", err)
		}

		ticker := time.NewTicker(cfg.Interval)
		defer ticker.Stop()

		for range ticker.C {
			if err := performBackup(cfg, db); err != nil {
				log.Printf("Database backup failed: %v", err)
			}
		}
	}()
}

func performBackup(cfg Config, db *gorm.DB) error {
	if err := os.MkdirAll(cfg.BackupDir, 0700); err != nil {
		return fmt.Errorf("create backup directory: %w", err)
	}

	// Pre-clean and space check before writing a new backup
	if cfg.MaxTotalBytes > 0 {
		if err := enforceMaxSize(cfg); err != nil {
			return err
		}
	}
	if err := ensureFreeSpace(cfg); err != nil {
		return err
	}

	timestamp := time.Now().UTC().Format("20060102T150405Z")
	finalPath := filepath.Join(cfg.BackupDir, fmt.Sprintf("glowtype_%s.db", timestamp))
	tmpPath := finalPath + ".tmp"

	if err := createSQLiteBackup(db, tmpPath); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}

	if err := os.Chmod(tmpPath, 0600); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Printf("Warning: could not tighten permissions on backup %s: %v", tmpPath, err)
	}

	if err := os.Rename(tmpPath, finalPath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("move backup into place: %w", err)
	}

	fileInfo, err := os.Stat(finalPath)
	if err != nil {
		return fmt.Errorf("stat backup file: %w", err)
	}

	if cfg.MaxTotalBytes > 0 {
		if err := enforceMaxSize(cfg); err != nil {
			return err
		}
	}

	if err := ensureFreeSpace(cfg); err != nil {
		return err
	}

	log.Printf("Database backup created: %s (%s)", finalPath, formatBytes(fileInfo.Size()))
	return nil
}

// createSQLiteBackup uses VACUUM INTO to produce a consistent SQLite snapshot.
func createSQLiteBackup(db *gorm.DB, destPath string) error {
	if err := os.Remove(destPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("prepare backup destination: %w", err)
	}

	// Best-effort checkpoint to reduce WAL size before backup.
	if err := db.Exec("PRAGMA wal_checkpoint(PASSIVE)").Error; err != nil {
		log.Printf("Warning: wal_checkpoint before backup failed: %v", err)
	}

	sanitized := strings.ReplaceAll(filepath.ToSlash(destPath), "'", "''")
	statement := fmt.Sprintf("VACUUM INTO '%s'", sanitized)

	if err := db.Exec(statement).Error; err != nil {
		return fmt.Errorf("create sqlite backup with VACUUM INTO: %w", err)
	}

	return nil
}

// enforceMaxSize keeps total backup size under the configured limit by deleting oldest files.
func enforceMaxSize(cfg Config) error {
	files, total, err := listBackups(cfg.BackupDir)
	if err != nil {
		return err
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].modTime.Before(files[j].modTime)
	})

	for len(files) > 1 && total > cfg.MaxTotalBytes {
		oldest := files[0]
		if err := os.Remove(oldest.path); err != nil {
			return fmt.Errorf("remove old backup %s: %w", oldest.path, err)
		}
		log.Printf("Removed old backup: %s (freed %s)", oldest.path, formatBytes(oldest.size))
		total -= oldest.size
		files = files[1:]
	}

	if total > cfg.MaxTotalBytes && len(files) == 1 {
		log.Printf("Backup directory exceeds max size (%s); latest backup alone is %s. Consider raising BACKUP_MAX_TOTAL_BYTES.",
			formatBytes(cfg.MaxTotalBytes), formatBytes(total))
	}

	return nil
}

// ensureFreeSpace avoids filling the disk: keeps a safety buffer and tries to free space by deleting oldest backups.
func ensureFreeSpace(cfg Config) error {
	if cfg.MinFreeBytes <= 0 {
		return nil
	}

	files, _, err := listBackups(cfg.BackupDir)
	if err != nil {
		return err
	}
	sort.Slice(files, func(i, j int) bool {
		return files[i].modTime.Before(files[j].modTime)
	})

	free, err := diskFreeBytes(cfg.BackupDir)
	if err != nil {
		return fmt.Errorf("check free disk space: %w", err)
	}
	freeInt, err := safeUint64ToInt64(free)
	if err != nil {
		return fmt.Errorf("free space overflow: %w", err)
	}

	dbSize := int64(0)
	if info, statErr := os.Stat(cfg.DBPath); statErr == nil {
		dbSize = info.Size()
	}

	required := cfg.MinFreeBytes + dbSize
	if freeInt >= required {
		return nil
	}

	for len(files) > 0 && freeInt < required {
		oldest := files[0]
		if err := os.Remove(oldest.path); err != nil {
			return fmt.Errorf("remove old backup %s: %w", oldest.path, err)
		}
		log.Printf("Removed old backup to free space: %s (%s)", oldest.path, formatBytes(oldest.size))
		files = files[1:]
		// Re-check after each deletion
		free, err = diskFreeBytes(cfg.BackupDir)
		if err != nil {
			return fmt.Errorf("check free disk space: %w", err)
		}
		freeInt, err = safeUint64ToInt64(free)
		if err != nil {
			return fmt.Errorf("free space overflow: %w", err)
		}
	}

	if freeInt < required {
		return fmt.Errorf("not enough disk space for backup: need ~%s free (db %s + buffer %s), current free %s",
			formatBytes(required), formatBytes(dbSize), formatBytes(cfg.MinFreeBytes), formatBytes(freeInt))
	}

	return nil
}

func listBackups(dir string) ([]fileEntry, int64, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, 0, fmt.Errorf("list backups: %w", err)
	}

	var files []fileEntry
	var total int64

	for _, entry := range entries {
		if !entry.Type().IsRegular() {
			continue
		}
		if strings.HasSuffix(entry.Name(), ".tmp") {
			// Ignore temp files from in-progress backups
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		files = append(files, fileEntry{path: path, size: info.Size(), modTime: info.ModTime()})
		total += info.Size()
	}

	return files, total, nil
}

type fileEntry struct {
	path    string
	size    int64
	modTime time.Time
}

// safeUint64ToInt64 converts uint64 to int64 with overflow check.
func safeUint64ToInt64(v uint64) (int64, error) {
	if v > math.MaxInt64 {
		return 0, fmt.Errorf("value %d overflows int64", v)
	}
	return int64(v), nil
}

func diskFreeBytes(path string) (uint64, error) {
	var stat unix.Statfs_t
	if err := unix.Statfs(path, &stat); err != nil {
		return 0, err
	}
	if stat.Bsize < 0 {
		return 0, fmt.Errorf("unexpected negative block size")
	}
	blockSize := uint64(stat.Bsize)
	if stat.Bavail > math.MaxUint64/blockSize {
		return 0, fmt.Errorf("free space overflow")
	}
	return stat.Bavail * blockSize, nil
}

func formatBytes(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%dB", size)
	}
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f%ciB", float64(size)/float64(div), "KMGTPE"[exp])
}
