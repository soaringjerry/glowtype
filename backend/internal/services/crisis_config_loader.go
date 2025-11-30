package services

import (
	"log"
	"regexp"
	"sync"
	"time"

	"github.com/soaringjerry/glowtype/internal/database"
	"gorm.io/gorm"
)

// CrisisConfigLoader provides database-backed crisis configuration with hot-reload
type CrisisConfigLoader struct {
	mu sync.RWMutex
	db *gorm.DB

	// Current config version (for hot-reload detection)
	currentVersion int

	// Cached keywords by level and language
	keywordsByLevelLang map[int]map[string][]database.CrisisKeywordDB

	// Cached exclude patterns (compiled regex)
	excludePatterns []*regexp.Regexp

	// Cached resources by country
	resourcesByCountry map[string][]database.CrisisResourceDB

	// Cached forbidden phrases by language
	forbiddenByLang map[string][]database.CrisisForbiddenPhraseDB

	// Cached glowtype guidance
	guidanceByGlowtype map[string]map[string][]database.CrisisGlowtypeGuidanceDB // glowtypeCode -> language -> entries

	// Settings
	settings *database.CrisisSettingsDB

	// Last reload time
	lastReload time.Time
}

// NewCrisisConfigLoader creates a new config loader
func NewCrisisConfigLoader(db *gorm.DB) *CrisisConfigLoader {
	loader := &CrisisConfigLoader{
		db:                  db,
		keywordsByLevelLang: make(map[int]map[string][]database.CrisisKeywordDB),
		excludePatterns:     make([]*regexp.Regexp, 0),
		resourcesByCountry:  make(map[string][]database.CrisisResourceDB),
		forbiddenByLang:     make(map[string][]database.CrisisForbiddenPhraseDB),
		guidanceByGlowtype:  make(map[string]map[string][]database.CrisisGlowtypeGuidanceDB),
	}

	// Initial load
	if err := loader.Reload(); err != nil {
		log.Printf("[CrisisConfigLoader] Initial load error: %v", err)
	}

	return loader
}

// CheckAndReload checks if config version changed and reloads if necessary
// Returns true if reloaded
func (l *CrisisConfigLoader) CheckAndReload() bool {
	settings, err := database.GetCrisisSettings(l.db, nil)
	if err != nil {
		log.Printf("[CrisisConfigLoader] Error checking version: %v", err)
		return false
	}

	l.mu.RLock()
	needsReload := settings.ConfigVersion != l.currentVersion
	l.mu.RUnlock()

	if needsReload {
		log.Printf("[CrisisConfigLoader] Config version changed %d -> %d, reloading...",
			l.currentVersion, settings.ConfigVersion)
		if err := l.Reload(); err != nil {
			log.Printf("[CrisisConfigLoader] Reload error: %v", err)
		}
		return true
	}

	return false
}

// Reload loads all crisis configuration from database
func (l *CrisisConfigLoader) Reload() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Load settings first
	settings, err := database.GetCrisisSettings(l.db, nil)
	if err != nil {
		log.Printf("[CrisisConfigLoader] Error loading settings: %v", err)
		return err
	}
	l.settings = settings
	l.currentVersion = settings.ConfigVersion

	// Load keywords
	l.loadKeywords()

	// Load exclude patterns
	l.loadExcludePatterns()

	// Load resources
	l.loadResources()

	// Load forbidden phrases
	l.loadForbiddenPhrases()

	// Load glowtype guidance
	l.loadGlowtypeGuidance()

	l.lastReload = time.Now()

	log.Printf("[CrisisConfigLoader] Reloaded config version %d", l.currentVersion)

	return nil
}

func (l *CrisisConfigLoader) loadKeywords() {
	l.keywordsByLevelLang = make(map[int]map[string][]database.CrisisKeywordDB)

	var keywords []database.CrisisKeywordDB
	l.db.Where("is_active = ?", true).Find(&keywords)

	for _, kw := range keywords {
		if l.keywordsByLevelLang[kw.Level] == nil {
			l.keywordsByLevelLang[kw.Level] = make(map[string][]database.CrisisKeywordDB)
		}
		l.keywordsByLevelLang[kw.Level][kw.Language] = append(l.keywordsByLevelLang[kw.Level][kw.Language], kw)
	}

	log.Printf("[CrisisConfigLoader] Loaded %d keywords", len(keywords))
}

func (l *CrisisConfigLoader) loadExcludePatterns() {
	l.excludePatterns = make([]*regexp.Regexp, 0)

	var patterns []database.CrisisExcludePatternDB
	l.db.Where("is_active = ?", true).Find(&patterns)

	for _, p := range patterns {
		// For regex patterns, compile them
		if p.PatternType == "regex" {
			if re, err := regexp.Compile(p.Pattern); err == nil {
				l.excludePatterns = append(l.excludePatterns, re)
			}
		} else {
			// For "contains" patterns, escape and create simple regex
			escaped := regexp.QuoteMeta(p.Pattern)
			if re, err := regexp.Compile("(?i)" + escaped); err == nil {
				l.excludePatterns = append(l.excludePatterns, re)
			}
		}
	}

	log.Printf("[CrisisConfigLoader] Loaded %d exclude patterns", len(l.excludePatterns))
}

func (l *CrisisConfigLoader) loadResources() {
	l.resourcesByCountry = make(map[string][]database.CrisisResourceDB)

	var resources []database.CrisisResourceDB
	l.db.Where("is_active = ?", true).Order("priority DESC").Find(&resources)

	for _, r := range resources {
		l.resourcesByCountry[r.Country] = append(l.resourcesByCountry[r.Country], r)
	}

	log.Printf("[CrisisConfigLoader] Loaded %d resources for %d countries",
		len(resources), len(l.resourcesByCountry))
}

func (l *CrisisConfigLoader) loadForbiddenPhrases() {
	l.forbiddenByLang = make(map[string][]database.CrisisForbiddenPhraseDB)

	var phrases []database.CrisisForbiddenPhraseDB
	l.db.Where("is_active = ?", true).Find(&phrases)

	for _, p := range phrases {
		l.forbiddenByLang[p.Language] = append(l.forbiddenByLang[p.Language], p)
	}

	log.Printf("[CrisisConfigLoader] Loaded %d forbidden phrases", len(phrases))
}

func (l *CrisisConfigLoader) loadGlowtypeGuidance() {
	l.guidanceByGlowtype = make(map[string]map[string][]database.CrisisGlowtypeGuidanceDB)

	var guidance []database.CrisisGlowtypeGuidanceDB
	l.db.Where("is_active = ?", true).Order("display_order").Find(&guidance)

	for _, g := range guidance {
		if l.guidanceByGlowtype[g.GlowtypeCode] == nil {
			l.guidanceByGlowtype[g.GlowtypeCode] = make(map[string][]database.CrisisGlowtypeGuidanceDB)
		}
		l.guidanceByGlowtype[g.GlowtypeCode][g.Language] = append(
			l.guidanceByGlowtype[g.GlowtypeCode][g.Language], g)
	}

	log.Printf("[CrisisConfigLoader] Loaded guidance for %d glowtypes", len(l.guidanceByGlowtype))
}

// ============ Getters ============

// GetKeywords returns keywords for a specific level and language
func (l *CrisisConfigLoader) GetKeywords(level int, language string) []database.CrisisKeywordDB {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if levelMap, ok := l.keywordsByLevelLang[level]; ok {
		return levelMap[language]
	}
	return nil
}

// GetAllKeywordsForLevel returns all keywords for a level (all languages)
func (l *CrisisConfigLoader) GetAllKeywordsForLevel(level int) []database.CrisisKeywordDB {
	l.mu.RLock()
	defer l.mu.RUnlock()

	var result []database.CrisisKeywordDB
	if levelMap, ok := l.keywordsByLevelLang[level]; ok {
		for _, keywords := range levelMap {
			result = append(result, keywords...)
		}
	}
	return result
}

// GetExcludePatterns returns compiled exclude patterns
func (l *CrisisConfigLoader) GetExcludePatterns() []*regexp.Regexp {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.excludePatterns
}

// GetResources returns resources for a country (with GLOBAL fallback)
func (l *CrisisConfigLoader) GetResources(country string) []database.CrisisResourceDB {
	l.mu.RLock()
	defer l.mu.RUnlock()

	var result []database.CrisisResourceDB

	// Try specific country first
	if resources, ok := l.resourcesByCountry[country]; ok {
		result = append(result, resources...)
	}

	// Add GLOBAL fallback
	if global, ok := l.resourcesByCountry["GLOBAL"]; ok {
		result = append(result, global...)
	}

	return result
}

// GetForbiddenPhrases returns forbidden phrases for a language
func (l *CrisisConfigLoader) GetForbiddenPhrases(language string) []database.CrisisForbiddenPhraseDB {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.forbiddenByLang[language]
}

// GetGlowtypeGuidance returns guidance for a glowtype and language
func (l *CrisisConfigLoader) GetGlowtypeGuidance(glowtypeCode, language string) []database.CrisisGlowtypeGuidanceDB {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if gtMap, ok := l.guidanceByGlowtype[glowtypeCode]; ok {
		return gtMap[language]
	}
	return nil
}

// GetSettings returns the current crisis settings
func (l *CrisisConfigLoader) GetSettings() *database.CrisisSettingsDB {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.settings
}

// GetConfigVersion returns the current config version
func (l *CrisisConfigLoader) GetConfigVersion() int {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.currentVersion
}

// ============ Convenience Methods ============

// GetKeywordStrings returns just the keyword strings for a level
func (l *CrisisConfigLoader) GetKeywordStrings(level int) (en []string, zh []string) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if levelMap, ok := l.keywordsByLevelLang[level]; ok {
		for _, kw := range levelMap["en"] {
			en = append(en, kw.Keyword)
		}
		for _, kw := range levelMap["zh"] {
			zh = append(zh, kw.Keyword)
		}
	}
	return en, zh
}

// GetSlangMappings returns slang -> meaning mappings
func (l *CrisisConfigLoader) GetSlangMappings() map[string]string {
	l.mu.RLock()
	defer l.mu.RUnlock()

	result := make(map[string]string)
	for _, levelMap := range l.keywordsByLevelLang {
		for _, keywords := range levelMap {
			for _, kw := range keywords {
				if kw.IsSlang && kw.SlangFor != "" {
					result[kw.Keyword] = kw.SlangFor
				}
			}
		}
	}
	return result
}
