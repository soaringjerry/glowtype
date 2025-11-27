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
	OpenAIAPIKey  string
	OpenAIBaseURL string
	OpenAIModel   string
}

func Load() Config {
	cfg := Config{
		Env:  getEnv("ENV", "development"),
		Port: getEnv("PORT", "18080"),
		// Default: same-origin only; configure ALLOWED_ORIGINS (comma-separated) to enable CORS.
		AllowedOrigin: getEnv("ALLOWED_ORIGINS", ""),
		LogLevel:      getEnv("LOG_LEVEL", "info"),
		ChatProvider:  getEnv("CHAT_PROVIDER", "mock"),
		OpenAIAPIKey:  getEnv("OPENAI_API_KEY", ""),
		OpenAIBaseURL: getEnv("OPENAI_API_BASE", "https://api.openai.com/v1"),
		OpenAIModel:   getEnv("OPENAI_MODEL", "gpt-4o-mini"),
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
