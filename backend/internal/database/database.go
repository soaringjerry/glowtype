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

	ensureDefaultSuperAdmin(db)

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
