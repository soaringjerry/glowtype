package main

import (
	"log"
	"os"

	"github.com/soaringjerry/glowtype/internal/config"
	"github.com/soaringjerry/glowtype/internal/server"
)

func main() {
	cfg := config.Load()

	engine := server.New(cfg)

	if err := engine.Run(":" + cfg.Port); err != nil {
		log.Printf("server exited with error: %v", err)
		os.Exit(1)
	}
}

