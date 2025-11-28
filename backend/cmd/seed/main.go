package main

import (
	"log"

	"github.com/soaringjerry/glowtype/internal/config"
	"github.com/soaringjerry/glowtype/internal/database"
)

func main() {
	log.Println("Initializing database...")
	cfg := config.Load()
	db := database.InitDB(cfg)

	// Force seed when running standalone (ignores SEED_DB env)
	database.SeedDatabase(db, true)
}
