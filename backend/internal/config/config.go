package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Env            string
	Port           string
	AllowedOrigin  string
	LogLevel       string
	ChatProvider   string
	OpenAIAPIKey   string
	OpenAIBaseURL  string
	OpenAIModel    string
	TrustedProxies string
	DBPath         string
	ConfigDir      string // Directory for JSON config files (crisis, prompts, etc.)

	BackupEnabled       bool
	BackupDir           string
	BackupIntervalMins  int
	BackupMaxTotalBytes int64
	BackupMinFreeBytes  int64
}

const (
	DefaultDBPath                = "/data/glowtype.db"
	DefaultConfigDir             = "./config"
	defaultBackupDir             = "/data/backup"
	defaultBackupIntervalMinutes = 60
	defaultBackupMaxTotalBytes   = int64(5 * 1024 * 1024 * 1024) // 5 GiB
	defaultBackupMinFreeBytes    = int64(1 * 1024 * 1024 * 1024) // 1 GiB safety buffer
)

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
		// TRUSTED_PROXIES: comma-separated CIDR/IP, or "auto" to trust private/loopback.
		// Default "auto,cloudflare" tries to recover real client IP when behind Cloudflare while staying safe elsewhere.
		TrustedProxies: getEnv("TRUSTED_PROXIES", "auto,cloudflare"),
		DBPath:         getEnv("DB_PATH", DefaultDBPath),
		ConfigDir:      getEnv("CONFIG_DIR", DefaultConfigDir),

		BackupEnabled:       getEnvBool("BACKUP_ENABLED", true),
		BackupDir:           getEnv("BACKUP_DIR", defaultBackupDir),
		BackupIntervalMins:  getEnvInt("BACKUP_INTERVAL_MINUTES", defaultBackupIntervalMinutes),
		BackupMaxTotalBytes: parseSizeInBytes(getEnv("BACKUP_MAX_TOTAL_BYTES", ""), defaultBackupMaxTotalBytes),
		BackupMinFreeBytes:  parseSizeInBytes(getEnv("BACKUP_MIN_FREE_BYTES", ""), defaultBackupMinFreeBytes),
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v, ok := os.LookupEnv(key); ok {
		switch strings.ToLower(strings.TrimSpace(v)) {
		case "1", "true", "yes", "y", "on":
			return true
		case "0", "false", "no", "n", "off":
			return false
		}
	}
	return fallback
}

func parseSizeInBytes(val string, fallback int64) int64 {
	v := strings.TrimSpace(val)
	if v == "" {
		return fallback
	}

	upper := strings.ToUpper(v)
	multiplier := int64(1)

	suffixes := []struct {
		suffix string
		factor int64
	}{
		{"TB", 1 << 40},
		{"T", 1 << 40},
		{"GB", 1 << 30},
		{"G", 1 << 30},
		{"MB", 1 << 20},
		{"M", 1 << 20},
		{"KB", 1 << 10},
		{"K", 1 << 10},
		{"B", 1},
	}

	for _, s := range suffixes {
		if strings.HasSuffix(upper, s.suffix) {
			upper = strings.TrimSuffix(upper, s.suffix)
			multiplier = s.factor
			break
		}
	}

	num, err := strconv.ParseFloat(strings.TrimSpace(upper), 64)
	if err != nil {
		return fallback
	}

	bytes := int64(num * float64(multiplier))
	if bytes <= 0 {
		return fallback
	}
	return bytes
}
