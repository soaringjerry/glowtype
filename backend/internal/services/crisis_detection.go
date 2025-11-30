package services

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"regexp"
	"strings"
	"sync"

	"gorm.io/gorm"
)

// Detection method identifiers
const (
	DetectionViaKeyword = "keyword"
	DetectionViaPattern = "pattern"
	DetectionViaML      = "ml_model"
)

// Trigger categories
const (
	TriggerCategorySelfHarm     = "self-harm"
	TriggerCategoryHopelessness = "hopelessness"
	TriggerCategoryIsolation    = "isolation"
	TriggerCategoryStress       = "stress"
)

// CrisisResult contains detection results
type CrisisResult struct {
	Level           int      `json:"level"`           // 0-3
	Triggers        []string `json:"triggers"`        // What patterns matched
	TriggerCategory string   `json:"triggerCategory"` // hopelessness/self-harm/isolation
	Via             string   `json:"via"`             // keyword/pattern/ml_model
	Confidence      float64  `json:"confidence"`      // For ML (1.0 for keyword)
	NeedsResponse   bool     `json:"needsResponse"`   // Should AI address this?
}

// ChatHistoryItem represents a message in conversation history
type ChatHistoryItem struct {
	Role    string `json:"role"`    // "user" or "assistant"
	Content string `json:"content"`
}

// CrisisKeywordsConfig represents the JSON config structure
type CrisisKeywordsConfig struct {
	Level3 struct {
		EN []string `json:"en"`
		ZH []string `json:"zh"`
	} `json:"level3"`
	Level2 struct {
		EN []string `json:"en"`
		ZH []string `json:"zh"`
	} `json:"level2"`
	Level1 struct {
		EN []string `json:"en"`
		ZH []string `json:"zh"`
	} `json:"level1"`
	SlangMappings   map[string]string `json:"slangMappings"`
	ExcludePatterns []string          `json:"excludePatterns"`
	DeclineKeywords []string          `json:"declineKeywords"`
}

// CrisisDetector provides multilevel crisis assessment
type CrisisDetector struct {
	mu sync.RWMutex

	// Keywords by level and language
	level3EN []string
	level3ZH []string
	level2EN []string
	level2ZH []string
	level1EN []string
	level1ZH []string

	// Slang mappings (e.g., "离开蓝星" -> "想死")
	slangMappings map[string]string

	// Exclude patterns (past tense, third person, quotes)
	excludePatterns []*regexp.Regexp

	// Keywords for detecting resource decline
	declineKeywords []string

	// Config file path for hot reload (legacy)
	configPath string

	// Database-backed config loader (new)
	configLoader *CrisisConfigLoader

	// Whether to use DB config
	useDBConfig bool
}

// NewCrisisDetector creates a new detector, loading config from file if available
// Deprecated: Use NewCrisisDetectorWithDB for database-backed config
func NewCrisisDetector(configPath string) *CrisisDetector {
	d := &CrisisDetector{
		configPath:      configPath,
		slangMappings:   make(map[string]string),
		excludePatterns: make([]*regexp.Regexp, 0),
		declineKeywords: make([]string, 0),
		useDBConfig:     false,
	}

	// Load from config file or use defaults
	if configPath != "" {
		if err := d.LoadConfig(configPath); err != nil {
			log.Printf("[CrisisDetector] Failed to load config from %s: %v, using defaults", configPath, err)
			d.loadDefaults()
		}
	} else {
		d.loadDefaults()
	}

	return d
}

// NewCrisisDetectorWithDB creates a detector using database-backed configuration
// This supports hot-reload when config is modified via admin panel
func NewCrisisDetectorWithDB(db *gorm.DB) *CrisisDetector {
	d := &CrisisDetector{
		slangMappings:   make(map[string]string),
		excludePatterns: make([]*regexp.Regexp, 0),
		declineKeywords: make([]string, 0),
		configLoader:    NewCrisisConfigLoader(db),
		useDBConfig:     true,
	}

	// Sync from DB config loader
	d.syncFromDBConfig()

	log.Printf("[CrisisDetector] Initialized with database-backed config")
	return d
}

// syncFromDBConfig synchronizes internal fields from the database config loader
func (d *CrisisDetector) syncFromDBConfig() {
	if d.configLoader == nil {
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	// Get keywords by level
	d.level3EN, d.level3ZH = d.configLoader.GetKeywordStrings(3)
	d.level2EN, d.level2ZH = d.configLoader.GetKeywordStrings(2)
	d.level1EN, d.level1ZH = d.configLoader.GetKeywordStrings(1)

	// Get slang mappings
	d.slangMappings = d.configLoader.GetSlangMappings()

	// Get exclude patterns
	d.excludePatterns = d.configLoader.GetExcludePatterns()

	// Default decline keywords (these could also be stored in DB if needed)
	d.declineKeywords = []string{
		"不想打电话", "别再说了", "不要再提", "别再提了", "不需要热线",
		"don't want to call", "stop mentioning", "don't mention", "no hotline",
	}

	log.Printf("[CrisisDetector] Synced from DB: L3=%d, L2=%d, L1=%d, slang=%d, patterns=%d",
		len(d.level3EN)+len(d.level3ZH),
		len(d.level2EN)+len(d.level2ZH),
		len(d.level1EN)+len(d.level1ZH),
		len(d.slangMappings),
		len(d.excludePatterns))
}

// CheckAndReload checks if DB config changed and reloads if necessary
// Call this periodically or before detection to ensure config is fresh
func (d *CrisisDetector) CheckAndReload() bool {
	if !d.useDBConfig || d.configLoader == nil {
		return false
	}

	if d.configLoader.CheckAndReload() {
		d.syncFromDBConfig()
		return true
	}
	return false
}

// GetConfigLoader returns the underlying config loader (for accessing resources, etc.)
func (d *CrisisDetector) GetConfigLoader() *CrisisConfigLoader {
	return d.configLoader
}

// loadDefaults sets default keywords when config file not available
func (d *CrisisDetector) loadDefaults() {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Level 3 - High risk (explicit self-harm/suicide)
	d.level3EN = []string{
		"suicide", "kill myself", "want to die", "self harm", "self-harm",
		"overdose", "end it all", "end my life", "cut myself", "hang myself",
	}
	d.level3ZH = []string{
		"自杀", "想死", "不想活", "自残", "割腕", "吃药", "结束一切",
		"跳楼", "上吊", "想死掉", "活不下去",
	}

	// Level 2 - Moderate risk (hopelessness, isolation)
	d.level2EN = []string{
		"no hope", "hopeless", "worthless", "no one cares", "nobody cares",
		"burden", "give up", "can't go on", "what's the point", "no reason to live",
	}
	d.level2ZH = []string{
		"绝望", "没人在乎", "我是累赘", "跟你说也没用", "撑不下去",
		"活着没意思", "没有希望", "算了吧", "没人理解我",
	}

	// Level 1 - Low concern (stress, sadness)
	d.level1EN = []string{
		"so sad", "hate my life", "feel empty", "overwhelming", "exhausted",
		"can't take it", "stressed out", "breaking down",
	}
	d.level1ZH = []string{
		"好累", "好难过", "讨厌自己", "压力好大", "心里空空的",
		"受不了了", "快崩溃了", "太难了",
	}

	// Slang mappings (internet slang -> meaning)
	d.slangMappings = map[string]string{
		"离开蓝星":   "想死",
		"去跳河":    "自杀",
		"18+版本":  "不想长大",
		"摆烂到底":   "放弃",
		"永远离开":   "自杀",
		"leave this world": "suicide",
	}

	// Exclude patterns (past tense, third person, quotes)
	excludePatternStrings := []string{
		`(?i)(以前|过去|曾经).{0,10}(想过|有过).{0,10}(自杀|死)`,
		`(?i)(朋友|他|她|同学|别人).{0,10}(想|说).{0,10}(死|自杀)`,
		`(?i)(新闻|报道|看到|听说).{0,10}(自杀|死)`,
		`(?i)(used to|in the past|before).{0,15}(want|wanted).{0,10}(die|suicide)`,
		`(?i)(friend|someone|they).{0,10}(said|told|mentioned).{0,10}(suicide|die)`,
	}
	for _, p := range excludePatternStrings {
		if re, err := regexp.Compile(p); err == nil {
			d.excludePatterns = append(d.excludePatterns, re)
		}
	}

	// Decline keywords
	d.declineKeywords = []string{
		"不想打电话", "别再说了", "不要再提", "别再提了", "不需要热线",
		"don't want to call", "stop mentioning", "don't mention", "no hotline",
	}
}

// LoadConfig loads keywords from a JSON config file
// Deprecated: Use NewCrisisDetectorWithDB for database-backed config with hot-reload
func (d *CrisisDetector) LoadConfig(path string) error {
	// #nosec G304 - path is from trusted internal config, not user input
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	var cfg CrisisKeywordsConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return err
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	d.level3EN = cfg.Level3.EN
	d.level3ZH = cfg.Level3.ZH
	d.level2EN = cfg.Level2.EN
	d.level2ZH = cfg.Level2.ZH
	d.level1EN = cfg.Level1.EN
	d.level1ZH = cfg.Level1.ZH
	d.slangMappings = cfg.SlangMappings
	d.declineKeywords = cfg.DeclineKeywords

	// Compile exclude patterns
	d.excludePatterns = make([]*regexp.Regexp, 0)
	for _, p := range cfg.ExcludePatterns {
		if re, err := regexp.Compile(p); err == nil {
			d.excludePatterns = append(d.excludePatterns, re)
		}
	}

	log.Printf("[CrisisDetector] Loaded config: L3=%d, L2=%d, L1=%d keywords",
		len(d.level3EN)+len(d.level3ZH),
		len(d.level2EN)+len(d.level2ZH),
		len(d.level1EN)+len(d.level1ZH))

	return nil
}

// ReloadConfig reloads the configuration (for hot updates)
func (d *CrisisDetector) ReloadConfig() error {
	if d.configPath == "" {
		return nil
	}
	return d.LoadConfig(d.configPath)
}

// Detect analyzes text for crisis indicators
// ctx is reserved for future ML model integration
// history is reserved for context-aware detection
func (d *CrisisDetector) Detect(ctx context.Context, message string, history []ChatHistoryItem) CrisisResult {
	// Check for config changes before detection (hot-reload)
	if d.useDBConfig {
		d.CheckAndReload()
	}

	d.mu.RLock()
	defer d.mu.RUnlock()

	result := CrisisResult{
		Level:      CrisisLevelNone,
		Triggers:   make([]string, 0),
		Via:        DetectionViaKeyword,
		Confidence: 1.0,
	}

	if message == "" {
		return result
	}

	// Normalize message
	text := strings.ToLower(message)

	// Step 1: Apply slang mappings
	for slang, meaning := range d.slangMappings {
		if strings.Contains(text, strings.ToLower(slang)) {
			text = strings.ReplaceAll(text, strings.ToLower(slang), meaning)
			result.Triggers = append(result.Triggers, slang)
		}
	}

	// Step 2: Check exclude patterns (past tense, third person, quotes)
	for _, re := range d.excludePatterns {
		if re.MatchString(message) {
			// Downgrade severity when exclude pattern matches
			// Still detect but at lower level
			result.Via = DetectionViaPattern
			break
		}
	}

	// Step 3: Check Level 3 (highest priority)
	if level, triggers, category := d.checkLevel3(text); level > 0 {
		// If exclude pattern matched, downgrade to Level 2
		if result.Via == DetectionViaPattern {
			result.Level = CrisisLevelMid
		} else {
			result.Level = level
		}
		result.Triggers = append(result.Triggers, triggers...)
		result.TriggerCategory = category
		result.NeedsResponse = true
		return result
	}

	// Step 4: Check Level 2
	if level, triggers, category := d.checkLevel2(text); level > 0 {
		result.Level = level
		result.Triggers = append(result.Triggers, triggers...)
		result.TriggerCategory = category
		result.NeedsResponse = true
		return result
	}

	// Step 5: Check Level 1
	if level, triggers, category := d.checkLevel1(text); level > 0 {
		result.Level = level
		result.Triggers = append(result.Triggers, triggers...)
		result.TriggerCategory = category
		result.NeedsResponse = false // Level 1 doesn't need special response
		return result
	}

	return result
}

// checkLevel3 checks for high-risk keywords
func (d *CrisisDetector) checkLevel3(text string) (int, []string, string) {
	triggers := make([]string, 0)

	for _, kw := range d.level3EN {
		if strings.Contains(text, strings.ToLower(kw)) {
			triggers = append(triggers, kw)
		}
	}
	for _, kw := range d.level3ZH {
		if strings.Contains(text, kw) {
			triggers = append(triggers, kw)
		}
	}

	if len(triggers) > 0 {
		return CrisisLevelHigh, triggers, TriggerCategorySelfHarm
	}
	return 0, nil, ""
}

// checkLevel2 checks for moderate-risk keywords
func (d *CrisisDetector) checkLevel2(text string) (int, []string, string) {
	triggers := make([]string, 0)

	for _, kw := range d.level2EN {
		if strings.Contains(text, strings.ToLower(kw)) {
			triggers = append(triggers, kw)
		}
	}
	for _, kw := range d.level2ZH {
		if strings.Contains(text, kw) {
			triggers = append(triggers, kw)
		}
	}

	if len(triggers) > 0 {
		return CrisisLevelMid, triggers, TriggerCategoryHopelessness
	}
	return 0, nil, ""
}

// checkLevel1 checks for low-concern keywords
func (d *CrisisDetector) checkLevel1(text string) (int, []string, string) {
	triggers := make([]string, 0)

	for _, kw := range d.level1EN {
		if strings.Contains(text, strings.ToLower(kw)) {
			triggers = append(triggers, kw)
		}
	}
	for _, kw := range d.level1ZH {
		if strings.Contains(text, kw) {
			triggers = append(triggers, kw)
		}
	}

	if len(triggers) > 0 {
		return CrisisLevelLow, triggers, TriggerCategoryStress
	}
	return 0, nil, ""
}

// DetectsResourceDecline checks if user is declining resources
func (d *CrisisDetector) DetectsResourceDecline(message string) bool {
	d.mu.RLock()
	defer d.mu.RUnlock()

	text := strings.ToLower(message)
	for _, kw := range d.declineKeywords {
		if strings.Contains(text, strings.ToLower(kw)) {
			return true
		}
	}
	return false
}
