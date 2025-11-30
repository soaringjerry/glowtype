package main

import (
	"flag"
	"fmt"
	"log"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// This script coarsens historic timestamps and removes stored User-Agent strings
// for end-user data in quiz_results and chat_sessions.
// Usage: go run ./scripts/cleanup_privacy.go -db ./glowtype.db
func main() {
	dbPath := flag.String("db", "./glowtype.db", "Path to SQLite database (glowtype.db)")
	flag.Parse()

	db, err := gorm.Open(sqlite.Open(*dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open db %s: %v", *dbPath, err)
	}

	type cleanupStep struct {
		desc string
		sql  string
	}

	steps := []cleanupStep{
		{
			desc: "clear quiz_results.user_agent",
			sql:  `UPDATE quiz_results SET user_agent = '' WHERE user_agent IS NOT NULL AND user_agent != ''`,
		},
		{
			desc: "truncate quiz_results.created_at to minute",
			sql:  `UPDATE quiz_results SET created_at = strftime('%Y-%m-%d %H:%M:00', created_at)`,
		},
		{
			desc: "truncate chat_sessions.started_at to minute",
			sql:  `UPDATE chat_sessions SET started_at = strftime('%Y-%m-%d %H:%M:00', started_at)`,
		},
		{
			desc: "truncate chat_sessions.ended_at to minute",
			sql:  `UPDATE chat_sessions SET ended_at = strftime('%Y-%m-%d %H:%M:00', ended_at)`,
		},
	}

	for _, step := range steps {
		if err := db.Exec(step.sql).Error; err != nil {
			log.Fatalf("step %q failed: %v", step.desc, err)
		}
		fmt.Println("✔", step.desc)
	}

	fmt.Println("Cleanup completed.")
}
