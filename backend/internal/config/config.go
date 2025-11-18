package config

import (
	"os"
)

type Config struct {
	Env           string
	Port          string
	AllowedOrigin string
	LogLevel      string
	ChatProvider  string
}

func Load() Config {
	cfg := Config{
		Env:           getEnv("ENV", "development"),
		Port:          getEnv("PORT", "18080"),
		AllowedOrigin: getEnv("ALLOWED_ORIGINS", "*"),
		LogLevel:      getEnv("LOG_LEVEL", "info"),
		ChatProvider:  getEnv("CHAT_PROVIDER", "mock"),
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
