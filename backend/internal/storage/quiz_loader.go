package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/soaringjerry/glowtype/internal/models"
)

func configDir() string {
	// Resolve relative to this file so it works from repo root or binary dir.
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filepath.Dir(filename)), "..", "config")
}

func LoadQuizConfig() (*models.QuizConfig, error) {
	path := filepath.Join(configDir(), "quiz.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read quiz config: %w", err)
	}

	var cfg models.QuizConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("unmarshal quiz config: %w", err)
	}

	return &cfg, nil
}
