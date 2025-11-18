package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/soaringjerry/glowtype/internal/models"
)

func glowtypeConfigDir() string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filepath.Dir(filename)), "..", "config")
}

func LoadGlowtypes() ([]models.GlowtypeConfig, error) {
	path := filepath.Join(glowtypeConfigDir(), "glowtypes.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read glowtypes config: %w", err)
	}

	var items []models.GlowtypeConfig
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, fmt.Errorf("unmarshal glowtypes config: %w", err)
	}

	return items, nil
}
