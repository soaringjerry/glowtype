package database

import (
	"log"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB initializes the SQLite database connection
func InitDB() *gorm.DB {
	dbPath := getEnv("DB_PATH", "/data/glowtype.db")

	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("Warning: could not create db directory %s: %v", dir, err)
		// Fall back to current directory
		dbPath = "./glowtype.db"
	}

	var gormLogger logger.Interface
	if getEnv("ENV", "development") == "production" {
		gormLogger = logger.Default.LogMode(logger.Silent)
	} else {
		gormLogger = logger.Default.LogMode(logger.Info)
	}

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: gormLogger,
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	// Auto migrate all models
	err = db.AutoMigrate(
		&TraitDimensionDB{},
		&QuizQuestionDB{},
		&GlowtypeDB{},
		&GlowtypeI18NDB{},
		&ScoringRuleDB{},
		&QuizResultDB{},
		&ChatSessionDB{},
		&AIPromptDB{},
		&BookChapterDB{},
		&GlowStickDB{},
		&UsageStats{},
		&GlowtypeStats{},
		&AdminUser{},
		&AdminLoginAttempt{},
		&AdminAuditLog{},
	)
	if err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	DB = db
	log.Printf("Database initialized at: %s", dbPath)

	// Run data migrations before default data setup
	migrateQuizResultsUniqueSessionID(db)

	ensureDefaultSuperAdmin(db)

	// Always ensure default prompts exist (supports upgrades)
	EnsureDefaultPrompts(db)

	// Always ensure default Glowpedia content exists (supports upgrades)
	EnsureDefaultGlowpedia(db)

	// Auto-seed if SEED_DB=true
	// SEED_DB_FORCE=true will clear existing data and re-seed
	if getEnv("SEED_DB", "") == "true" {
		force := getEnv("SEED_DB_FORCE", "") == "true"
		SeedDatabase(db, force)
	}

	return db
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return DB
}

// migrateQuizResultsUniqueSessionID removes duplicate session_id entries
// keeping only the first one, then creates a unique index if not exists.
// This migration is needed because we changed session_id from index to uniqueIndex.
func migrateQuizResultsUniqueSessionID(db *gorm.DB) {
	// Check if we have the unique index already
	var indexExists int64
	db.Raw(`SELECT COUNT(*) FROM pragma_index_list('quiz_results') WHERE name = 'idx_quiz_results_session_id'`).Scan(&indexExists)

	// Check if duplicates exist
	var duplicateCount int64
	db.Raw(`
		SELECT COUNT(*) FROM (
			SELECT session_id FROM quiz_results
			GROUP BY session_id HAVING COUNT(*) > 1
		)
	`).Scan(&duplicateCount)

	if duplicateCount > 0 {
		log.Printf("[Migration] Found %d duplicate session_ids in quiz_results, cleaning up...", duplicateCount)

		// Delete duplicates, keeping the one with smallest ID (earliest)
		result := db.Exec(`
			DELETE FROM quiz_results
			WHERE id NOT IN (
				SELECT MIN(id) FROM quiz_results GROUP BY session_id
			)
		`)

		if result.Error != nil {
			log.Printf("[Migration] Warning: failed to clean duplicates: %v", result.Error)
		} else {
			log.Printf("[Migration] Removed %d duplicate records", result.RowsAffected)
		}
	}

	// The unique index will be created by AutoMigrate based on the model definition
	log.Printf("[Migration] Quiz results session_id migration complete")
}
