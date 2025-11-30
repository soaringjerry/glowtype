package services

import (
	"encoding/json"
	"log"
	"os"
	"sort"
	"strings"
	"sync"

	"github.com/soaringjerry/glowtype/internal/database"
)

// CrisisResource represents a crisis support resource
type CrisisResource struct {
	Name   string            `json:"name"`
	Phone  string            `json:"phone,omitempty"`
	URL    string            `json:"url,omitempty"`
	Type   string            `json:"type,omitempty"`   // hotline, text, directory
	Region string            `json:"region,omitempty"` // Country code or "global"
	I18N   map[string]string `json:"i18n,omitempty"`   // Localized descriptions
}

// CrisisResourcesConfig represents the JSON config structure
type CrisisResourcesConfig struct {
	GlobalFallback []CrisisResource            `json:"globalFallback"`
	ByCountry      map[string][]CrisisResource `json:"byCountry"`
	ByLanguage     map[string][]CrisisResource `json:"byLanguage"`
}

// ResourceService provides crisis resource selection
type ResourceService struct {
	mu           sync.RWMutex
	config       *CrisisResourcesConfig
	configPath   string
	configLoader *CrisisConfigLoader // DB-backed config
	useDBConfig  bool
}

// NewResourceService creates a new resource service
// Deprecated: Use NewResourceServiceWithDB for database-backed config
func NewResourceService(configPath string) *ResourceService {
	s := &ResourceService{
		configPath:  configPath,
		config:      &CrisisResourcesConfig{},
		useDBConfig: false,
	}

	// Load from config file or use defaults
	if configPath != "" {
		if err := s.LoadConfig(configPath); err != nil {
			log.Printf("[ResourceService] Failed to load config from %s: %v, using defaults", configPath, err)
			s.loadDefaults()
		}
	} else {
		s.loadDefaults()
	}

	return s
}

// NewResourceServiceWithDB creates a resource service using database-backed configuration
func NewResourceServiceWithDB(loader *CrisisConfigLoader) *ResourceService {
	s := &ResourceService{
		config:       &CrisisResourcesConfig{},
		configLoader: loader,
		useDBConfig:  true,
	}

	log.Printf("[ResourceService] Initialized with DB-backed config")
	return s
}

// loadDefaults sets default resources when config file not available
func (s *ResourceService) loadDefaults() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.config = &CrisisResourcesConfig{
		GlobalFallback: []CrisisResource{
			{
				Name: "International Association for Suicide Prevention",
				URL:  "https://www.iasp.info/resources/Crisis_Centres/",
				Type: "directory",
				I18N: map[string]string{
					"en": "Find your local crisis center",
					"zh": "查找当地危机中心",
				},
			},
		},
		ByCountry: map[string][]CrisisResource{
			"CN": {
				{Name: "全国心理援助热线", Phone: "400-161-9995", Type: "hotline", Region: "CN"},
				{Name: "北京心理危机研究与干预中心", Phone: "010-82951332", Type: "hotline", Region: "CN"},
				{Name: "希望24热线", Phone: "400-161-9995", Type: "hotline", Region: "CN"},
			},
			"SG": {
				{Name: "Samaritans of Singapore (SOS)", Phone: "1-767", Type: "hotline", Region: "SG"},
				{Name: "IMH Helpline", Phone: "6389-2222", Type: "hotline", Region: "SG"},
			},
			"US": {
				{Name: "988 Suicide & Crisis Lifeline", Phone: "988", Type: "hotline", Region: "US"},
				{Name: "Crisis Text Line", Phone: "Text HOME to 741741", Type: "text", Region: "US"},
			},
			"UK": {
				{Name: "Samaritans", Phone: "116 123", Type: "hotline", Region: "UK"},
				{Name: "SHOUT", Phone: "Text SHOUT to 85258", Type: "text", Region: "UK"},
			},
			"TW": {
				{Name: "生命線", Phone: "1925", Type: "hotline", Region: "TW"},
				{Name: "安心專線", Phone: "1980", Type: "hotline", Region: "TW"},
			},
			"HK": {
				{Name: "撒瑪利亞防止自殺會", Phone: "2389 2222", Type: "hotline", Region: "HK"},
				{Name: "香港撒瑪利亞防止自殺會", Phone: "2382 0000", Type: "hotline", Region: "HK"},
			},
		},
		ByLanguage: map[string][]CrisisResource{
			"zh": {
				{Name: "全国心理援助热线", Phone: "400-161-9995", Type: "hotline"},
			},
			"en": {
				{Name: "988 Suicide & Crisis Lifeline", Phone: "988", Type: "hotline"},
			},
		},
	}
}

// LoadConfig loads resources from a JSON config file
func (s *ResourceService) LoadConfig(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	var cfg CrisisResourcesConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = &cfg

	log.Printf("[ResourceService] Loaded config: %d countries, %d languages, %d global fallbacks",
		len(cfg.ByCountry), len(cfg.ByLanguage), len(cfg.GlobalFallback))

	return nil
}

// ReloadConfig reloads the configuration (for hot updates)
func (s *ResourceService) ReloadConfig() error {
	if s.configPath == "" {
		return nil
	}
	return s.LoadConfig(s.configPath)
}

// GetResources returns appropriate crisis resources based on language, region, and risk level
func (s *ResourceService) GetResources(language, region string, riskLevel int) []CrisisResource {
	// Use DB-backed config if available
	if s.useDBConfig && s.configLoader != nil {
		return s.getResourcesFromDB(language, region, riskLevel)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []CrisisResource

	// Normalize inputs
	language = strings.ToLower(strings.TrimSpace(language))
	region = strings.ToUpper(strings.TrimSpace(region))

	// Map language variations
	if strings.HasPrefix(language, "zh") {
		language = "zh"
	}

	// 1. Try country-specific resources first
	if region != "" {
		if countryResources, ok := s.config.ByCountry[region]; ok && len(countryResources) > 0 {
			result = append(result, countryResources...)
		}
	}

	// 2. If no country match, try language-based fallback
	if len(result) == 0 && language != "" {
		if langResources, ok := s.config.ByLanguage[language]; ok && len(langResources) > 0 {
			result = append(result, langResources...)
		}
	}

	// 3. Always add global fallback (directory to find local resources)
	result = append(result, s.config.GlobalFallback...)

	// 4. Sort by type priority for high-risk situations
	if riskLevel >= CrisisLevelHigh {
		sort.Slice(result, func(i, j int) bool {
			// Hotlines first, then text, then directories
			return getTypePriority(result[i].Type) < getTypePriority(result[j].Type)
		})
	}

	// 5. Limit to reasonable number
	if len(result) > 5 {
		result = result[:5]
	}

	return result
}

// getResourcesFromDB retrieves resources from database config
func (s *ResourceService) getResourcesFromDB(language, region string, riskLevel int) []CrisisResource {
	var result []CrisisResource

	// Normalize inputs
	language = strings.ToLower(strings.TrimSpace(language))
	region = strings.ToUpper(strings.TrimSpace(region))

	// Map language variations
	if strings.HasPrefix(language, "zh") {
		language = "zh"
	}

	// Get resources from DB (includes country-specific + GLOBAL fallback)
	dbResources := s.configLoader.GetResources(region)

	// Convert to CrisisResource format
	for _, r := range dbResources {
		cr := CrisisResource{
			Name:   r.Name,
			Phone:  r.Phone,
			URL:    r.URL,
			Region: r.Country,
		}
		// Use localized name if available
		if language == "zh" && r.NameZh != "" {
			cr.Name = r.NameZh
		}
		result = append(result, cr)
	}

	// Sort by type priority for high-risk situations
	if riskLevel >= CrisisLevelHigh {
		sort.Slice(result, func(i, j int) bool {
			return getTypePriority(result[i].Type) < getTypePriority(result[j].Type)
		})
	}

	// Limit to reasonable number
	if len(result) > 5 {
		result = result[:5]
	}

	return result
}

// dbResourceToType converts DB resource to type string based on available fields
func dbResourceToType(r database.CrisisResourceDB) string {
	if r.Phone != "" {
		return "hotline"
	}
	if r.URL != "" {
		return "directory"
	}
	return "hotline"
}

// getTypePriority returns priority for sorting (lower = higher priority)
func getTypePriority(t string) int {
	switch t {
	case "hotline":
		return 1
	case "text":
		return 2
	case "directory":
		return 3
	default:
		return 4
	}
}

// GetLocalizedDescription returns the localized description for a resource
func (r *CrisisResource) GetLocalizedDescription(language string) string {
	if r.I18N == nil {
		return ""
	}

	// Normalize language
	language = strings.ToLower(strings.TrimSpace(language))
	if strings.HasPrefix(language, "zh") {
		language = "zh"
	}

	if desc, ok := r.I18N[language]; ok {
		return desc
	}

	// Fallback to English
	if desc, ok := r.I18N["en"]; ok {
		return desc
	}

	return ""
}

// FormatForDisplay formats the resource for display
func (r *CrisisResource) FormatForDisplay(language string) string {
	if r.Phone != "" {
		return r.Name + ": " + r.Phone
	}
	if r.URL != "" {
		desc := r.GetLocalizedDescription(language)
		if desc != "" {
			return r.Name + " - " + desc
		}
		return r.Name
	}
	return r.Name
}
