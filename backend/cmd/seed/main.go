package main

import (
	"log"

	"github.com/soaringjerry/glowtype/internal/database"
)

func main() {
	log.Println("Initializing database...")
	db := database.InitDB()

	// Force seed when running standalone (ignores SEED_DB env)
	database.SeedDatabase(db, true)
}
