package database

import (
	"errors"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ============ Multi-tenant Support ============

// TenantID is nullable: nil = public/global, non-nil = org-specific
// This allows same system to serve public users + institutional deployments

// ============ Trait Dimensions ============

// TraitDimensionDB defines bipolar scoring dimensions (like MBTI's E-I, S-N, T-F, J-P)
type TraitDimensionDB struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	TenantID     *uint  `gorm:"index" json:"tenantId"`                          // nil = global
	Key          string `gorm:"uniqueIndex:idx_tenant_key;not null" json:"key"` // e.g., "energy"
	NameZH       string `json:"nameZh"`
	NameEN       string `json:"nameEn"`
	PositivePole string `json:"positivePole"` // e.g., "extrovert" (score > 0)
	NegativePole string `json:"negativePole"` // e.g., "introvert" (score < 0)
	Description  string `gorm:"type:text" json:"description"`

	// Thresholds for intensity labels (display only, not for rule matching)
	// Used for showing "Strong/Mild/Neutral" in results
	// e.g., |score| > StrongThreshold = "Strong", > MildThreshold = "Mild", else "Balanced"
	StrongThreshold float64 `gorm:"default:3" json:"strongThreshold"`
	MildThreshold   float64 `gorm:"default:1" json:"mildThreshold"`

	DisplayOrder int `gorm:"default:0" json:"displayOrder"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (TraitDimensionDB) TableName() string {
	return "trait_dimensions"
}

// ============ Quiz Questions ============

// QuizQuestionDB represents a quiz question
type QuizQuestionDB struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	TenantID   *uint  `gorm:"index" json:"tenantId"`
	QuestionID string `gorm:"uniqueIndex:idx_tenant_qid;not null" json:"questionId"`
	Order      int    `gorm:"not null" json:"order"`

	// Question text (bilingual)
	QuestionZH string `gorm:"type:text" json:"questionZh"`
	QuestionEN string `gorm:"type:text" json:"questionEn"`

	// Options as structured JSON array
	// Format: [{"text":{"en":"...","zh":"..."},"value":"trait_name","scores":{"energy":-1,"style":1}}]
	// Note: dimension keys in scores should match TraitDimensionDB.Key
	Options datatypes.JSON `gorm:"type:json" json:"options"`

	// For admin grouping only, not used in scoring
	PrimaryDimensionID *uint `json:"primaryDimensionId"`

	Version  int  `gorm:"default:1" json:"version"`
	IsActive bool `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (QuizQuestionDB) TableName() string {
	return "quiz_questions"
}

// OptionConfig is the Go struct for parsing Options JSON
type OptionConfig struct {
	Text   map[string]string  `json:"text"`   // {"en": "...", "zh": "..."}
	Value  string             `json:"value"`  // trait identifier for debugging
	Scores map[string]float64 `json:"scores"` // dimension key -> score delta
}

// ============ Glowtypes (Result Types) ============

// GlowtypeDB represents a result type - structural/styling data only
// Text content is in GlowtypeI18NDB for proper localization
type GlowtypeDB struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	TenantID *uint  `gorm:"index" json:"tenantId"`
	TypeCode string `gorm:"uniqueIndex:idx_tenant_type;not null" json:"typeCode"`

	// Styling (language-independent)
	AuraGradient string `json:"auraGradient"`
	CardAccent   string `json:"cardAccent"`
	TextColor    string `json:"textColor"`
	PrimaryColor string `json:"primaryColor"`
	IconName     string `json:"iconName"` // e.g., "comet", "nebula"

	Version  int  `gorm:"default:1" json:"version"`
	IsActive bool `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (GlowtypeDB) TableName() string {
	return "glowtypes"
}

// GlowtypeI18NDB stores localized text content for each Glowtype
type GlowtypeI18NDB struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	GlowtypeID   uint   `gorm:"index;not null" json:"glowtypeId"`
	Lang         string `gorm:"index;not null" json:"lang"` // "en", "zh", "zh-Hant", etc.
	Name         string `json:"name"`
	Tagline      string `json:"tagline"`
	Description  string `gorm:"type:text" json:"description"`
	SelfCareTips string `gorm:"type:text" json:"selfCareTips"` // JSON array
	Disclaimer   string `gorm:"type:text" json:"disclaimer"`
	MatchSummary string `gorm:"type:text" json:"matchSummary"` // Human-readable rule summary

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (GlowtypeI18NDB) TableName() string {
	return "glowtype_i18n"
}

// ============ Scoring Rules ============

// ScoringRuleDB defines how to map dimension scores to result types
// THIS IS THE SINGLE SOURCE OF TRUTH for Glowtype matching logic
//
// Decision Protocol:
// 1. Rules are evaluated in Priority order (higher priority first)
// 2. First matching rule wins (no multi-type assignment by default)
// 3. If no rule matches, fallback to DefaultGlowtype (if configured) or return "Unmapped"
//
// Condition Semantics:
// - min: score >= min (nil = no lower bound)
// - max: score <= max (nil = no upper bound)
// - Both nil: any value matches (dimension ignored)
type ScoringRuleDB struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	TenantID    *uint  `gorm:"index" json:"tenantId"`
	Name        string `gorm:"uniqueIndex:idx_tenant_rule_name;not null" json:"name"`
	Description string `gorm:"type:text" json:"description"`

	// Structured conditions: {"dimensions": {"energy": {"max": 0}, "style": {"min": -2, "max": 2}}}
	Conditions datatypes.JSON `gorm:"type:json" json:"conditions"`

	// Result type code (references GlowtypeDB.TypeCode)
	ResultTypeCode string `gorm:"index;not null" json:"resultTypeCode"`

	// Higher priority = checked first
	Priority int `gorm:"default:0;index" json:"priority"`

	// Is this the fallback rule? (matches when no other rule matches)
	IsFallback bool `gorm:"default:false" json:"isFallback"`

	Version  int  `gorm:"default:1" json:"version"`
	IsActive bool `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (ScoringRuleDB) TableName() string {
	return "scoring_rules"
}

// RuleConditions is the Go struct for parsing Conditions JSON
type RuleConditions struct {
	Dimensions map[string]DimensionCondition `json:"dimensions"`
}

// DimensionCondition defines bounds for a single dimension
// Semantics: min <= score <= max (nil = unbounded on that side)
type DimensionCondition struct {
	Min *float64 `json:"min,omitempty"` // score >= min, nil = -∞
	Max *float64 `json:"max,omitempty"` // score <= max, nil = +∞
}

// ============ Quiz Results (History/Research) ============

// QuizResultDB stores user quiz results for tracking and research
// NO PII - only stores answers and computed results
type QuizResultDB struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	TenantID    *uint  `gorm:"index" json:"tenantId"`
	SessionID   string `gorm:"index;not null" json:"sessionId"`  // Anonymous session identifier
	AnswersHash string `gorm:"index;size:64" json:"answersHash"` // SHA256 hash for deduplication

	// User's answers: [{"questionId": "q1", "optionIndex": 0, "optionValue": "introvert"}]
	Answers datatypes.JSON `gorm:"type:json" json:"answers"`

	// Computed dimension scores: {"energy": -3, "style": -2}
	DimensionScores datatypes.JSON `gorm:"type:json" json:"dimensionScores"`

	// Final result (denormalized for easy querying/reporting)
	ResultTypeCode  string `gorm:"index" json:"resultTypeCode"`
	GlowtypeVersion int    `json:"glowtypeVersion"`

	// Version tracking for reproducibility
	QuestionVersion int `json:"questionVersion"`
	RuleVersion     int `json:"ruleVersion"`

	// Metadata (no PII)
	Language  string `json:"language"`
	UserAgent string `json:"userAgent"`
	Source    string `json:"source"` // "web", "app", "embed"

	// Anonymized analytics fields (derived from request, original data discarded)
	Region      string `gorm:"index" json:"region"` // Country/region code (derived from IP, IP not stored)
	DeviceType  string `json:"deviceType"`          // "mobile", "tablet", "desktop" (parsed from UA)
	BrowserLang string `json:"browserLang"`         // Browser language preference (from Accept-Language)
	HourOfDay   int    `json:"hourOfDay"`           // 0-23, local hour when quiz was taken

	// Traffic attribution (for marketing analysis)
	Channel    string `gorm:"index" json:"channel"` // Distribution channel: "wechat", "linkedin", "organic", etc.
	EntryPoint string `json:"entryPoint"`           // Specific campaign/source: "homepage", "blog_post_1", "ad_campaign_q1"
	Referrer   string `json:"referrer"`             // HTTP referer (if available)

	// Test data marking (admin sessions auto-marked)
	IsTest bool `gorm:"default:false;index" json:"isTest"`

	CreatedAt time.Time `json:"createdAt"`
}

// ============ Chat Sessions (Anonymous Analytics) ============

// ChatSessionDB tracks anonymous chat session metrics
// NO PII - only aggregated metrics for analysis
type ChatSessionDB struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	TenantID  *uint  `gorm:"index" json:"tenantId"`
	SessionID string `gorm:"index;not null" json:"sessionId"` // Anonymous session identifier

	// Chat metrics
	MessageCount int `json:"messageCount"` // Total messages in session
	UserMessages int `json:"userMessages"` // Messages from user
	AIMessages   int `json:"aiMessages"`   // Messages from AI
	DurationSecs int `json:"durationSecs"` // Session duration in seconds

	// Context
	GlowtypeCode string `gorm:"index" json:"glowtypeCode"` // User's glowtype (if known)
	Language     string `json:"language"`

	// Anonymized analytics
	Region     string `gorm:"index" json:"region"` // Country/region (derived from IP)
	DeviceType string `json:"deviceType"`
	HourOfDay  int    `json:"hourOfDay"`

	// Flags for research
	HasCrisisKeywords bool `json:"hasCrisisKeywords"` // Whether crisis keywords were detected

	// Test data marking (admin sessions auto-marked)
	IsTest bool `gorm:"default:false;index" json:"isTest"`

	StartedAt time.Time `json:"startedAt"`
	EndedAt   time.Time `json:"endedAt"`
}

func (QuizResultDB) TableName() string {
	return "quiz_results"
}

func (ChatSessionDB) TableName() string {
	return "chat_sessions"
}

// ============ Crisis Events (for research) ============

// CrisisEventDB logs crisis detection events for research (NO message content)
// This data is anonymized and used for improving crisis detection systems
type CrisisEventDB struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	TenantID *uint  `gorm:"index" json:"tenantId"`

	// Anonymous identifiers
	SessionID string `gorm:"index;not null" json:"sessionId"` // Anonymous session

	// User context (anonymized)
	GlowtypeCode string `gorm:"index" json:"glowtypeCode"` // User's light type
	Language     string `json:"language"`
	Region       string `gorm:"index" json:"region"` // Derived from IP (anonymized)
	DeviceType   string `json:"deviceType"`

	// Crisis detection results
	RiskLevel       int    `gorm:"index" json:"riskLevel"`       // 1, 2, or 3
	TriggerCategory string `json:"triggerCategory"`              // hopelessness/self-harm/isolation
	Via             string `json:"via"`                          // keyword/pattern/ml_model

	// Conversation context (NO content)
	MessageIndex  int `json:"messageIndex"`  // Which message triggered detection
	TotalMessages int `json:"totalMessages"` // Total messages in session at time of event

	// Timing
	CreatedAt time.Time `gorm:"index" json:"createdAt"`

	// Test data marking (admin sessions auto-marked)
	IsTest bool `gorm:"default:false;index" json:"isTest"`
}

func (CrisisEventDB) TableName() string {
	return "crisis_events"
}

// ============ Crisis Configuration (Admin-configurable, Hot-reloadable) ============

// CrisisKeywordDB stores crisis detection keywords
type CrisisKeywordDB struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	TenantID *uint  `gorm:"index" json:"tenantId"`
	Level    int    `gorm:"index;not null" json:"level"`    // 1, 2, or 3
	Language string `gorm:"index;not null" json:"language"` // en, zh
	Keyword  string `gorm:"not null" json:"keyword"`
	Category string `json:"category"` // hopelessness, self-harm, isolation
	IsSlang  bool   `gorm:"default:false" json:"isSlang"`
	SlangFor string `json:"slangFor"` // If slang, what it maps to
	IsActive bool   `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (CrisisKeywordDB) TableName() string {
	return "crisis_keywords"
}

// CrisisExcludePatternDB stores patterns to exclude from crisis detection
type CrisisExcludePatternDB struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	TenantID    *uint  `gorm:"index" json:"tenantId"`
	Pattern     string `gorm:"not null" json:"pattern"`           // Regex or simple pattern
	PatternType string `gorm:"default:contains" json:"patternType"` // contains, regex, prefix, suffix
	Description string `json:"description"`                       // e.g., "Past tense - was feeling"
	Language    string `gorm:"index" json:"language"`             // en, zh, or empty for all
	IsActive    bool   `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (CrisisExcludePatternDB) TableName() string {
	return "crisis_exclude_patterns"
}

// CrisisResourceDB stores crisis helpline resources by region
type CrisisResourceDB struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	TenantID *uint  `gorm:"index" json:"tenantId"`
	Country  string `gorm:"index;not null" json:"country"` // CN, US, SG, etc.
	Language string `gorm:"index" json:"language"`         // For language-specific resources
	Name     string `gorm:"not null" json:"name"`
	NameZh   string `json:"nameZh"`
	Phone    string `json:"phone"`
	URL      string `json:"url"`
	Hours    string `json:"hours"`    // e.g., "24/7", "9am-9pm"
	Priority int    `gorm:"default:0" json:"priority"` // Higher = shown first
	IsActive bool   `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (CrisisResourceDB) TableName() string {
	return "crisis_resources"
}

// CrisisForbiddenPhraseDB stores phrases AI should never say
type CrisisForbiddenPhraseDB struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	TenantID    *uint  `gorm:"index" json:"tenantId"`
	Language    string `gorm:"index;not null" json:"language"` // en, zh
	Phrase      string `gorm:"not null" json:"phrase"`
	Alternative string `json:"alternative"` // Suggested alternative
	Category    string `json:"category"`    // diagnosis, dismissive, toxic_positivity
	IsActive    bool   `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (CrisisForbiddenPhraseDB) TableName() string {
	return "crisis_forbidden_phrases"
}

// CrisisGlowtypeGuidanceDB stores per-glowtype AI guidance
type CrisisGlowtypeGuidanceDB struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	TenantID     *uint  `gorm:"index" json:"tenantId"`
	GlowtypeCode string `gorm:"index;not null" json:"glowtypeCode"` // radiant-nebula, etc.
	Language     string `gorm:"index;not null" json:"language"`     // en, zh
	FieldType    string `gorm:"index;not null" json:"fieldType"`    // energyStyle, expressionStyle, metaphor, selfCareTip
	Content      string `gorm:"type:text;not null" json:"content"`
	DisplayOrder int    `gorm:"default:0" json:"displayOrder"`
	IsActive     bool   `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (CrisisGlowtypeGuidanceDB) TableName() string {
	return "crisis_glowtype_guidance"
}

// CrisisSettingsDB stores global crisis detection settings
type CrisisSettingsDB struct {
	ID       uint  `gorm:"primaryKey" json:"id"`
	TenantID *uint `gorm:"index" json:"tenantId"`

	// Detection settings
	SessionTTLMinutes         int  `gorm:"default:60" json:"sessionTTLMinutes"`
	MaxHistoryMessages        int  `gorm:"default:10" json:"maxHistoryMessages"`
	MaxResourceShowsPerSession int  `gorm:"default:2" json:"maxResourceShowsPerSession"`
	EnableKeywordDetection    bool `gorm:"default:true" json:"enableKeywordDetection"`
	EnablePatternDetection    bool `gorm:"default:true" json:"enablePatternDetection"`
	EnableMLDetection         bool `gorm:"default:false" json:"enableMLDetection"`

	// Alert settings
	Level3AlertEnabled  bool   `gorm:"default:false" json:"level3AlertEnabled"`
	Level3AlertEmail    string `json:"level3AlertEmail"`
	Level3AlertWebhook  string `json:"level3AlertWebhook"` // Slack/Discord webhook
	DailyDigestEnabled  bool   `gorm:"default:false" json:"dailyDigestEnabled"`
	DailyDigestEmail    string `json:"dailyDigestEmail"`

	// Version tracking for hot-reload
	ConfigVersion int       `gorm:"default:1" json:"configVersion"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func (CrisisSettingsDB) TableName() string {
	return "crisis_settings"
}

// GetCrisisSettings returns the singleton crisis settings record
func GetCrisisSettings(db *gorm.DB, tenantID *uint) (*CrisisSettingsDB, error) {
	var settings CrisisSettingsDB
	query := db.Where("tenant_id IS NULL")
	if tenantID != nil {
		query = db.Where("tenant_id = ?", *tenantID)
	}

	err := query.First(&settings).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			settings = CrisisSettingsDB{
				TenantID:                   tenantID,
				SessionTTLMinutes:          60,
				MaxHistoryMessages:         10,
				MaxResourceShowsPerSession: 2,
				EnableKeywordDetection:     true,
				EnablePatternDetection:     true,
				EnableMLDetection:          false,
				Level3AlertEnabled:         false,
				DailyDigestEnabled:         false,
				ConfigVersion:              1,
			}
			if err := db.Create(&settings).Error; err != nil {
				return nil, err
			}
			return &settings, nil
		}
		return nil, err
	}
	return &settings, nil
}

// AnswerRecord is the Go struct for parsing Answers JSON
type AnswerRecord struct {
	QuestionID  string `json:"questionId"`
	OptionIndex int    `json:"optionIndex"`
	OptionValue string `json:"optionValue"`
}

// ============ AI Prompts ============

// AIPromptDB represents an AI prompt configuration
type AIPromptDB struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	TenantID    *uint  `gorm:"index" json:"tenantId"`
	Key         string `gorm:"uniqueIndex:idx_tenant_prompt;not null" json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"` // What this prompt is used for
	Content     string `gorm:"type:text;not null" json:"content"`

	Version  int  `gorm:"default:1" json:"version"`
	IsActive bool `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (AIPromptDB) TableName() string {
	return "ai_prompts"
}

// ============ Glowpedia (光签) ============

// BookChapterDB represents a chapter/category in Glowpedia
type BookChapterDB struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	TenantID  *uint  `gorm:"index" json:"tenantId"`
	ChapterID string `gorm:"uniqueIndex:idx_tenant_chapter;not null" json:"chapterId"` // e.g., "calm", "anxiety"
	NameZH    string `json:"nameZh"`
	NameEN    string `json:"nameEn"`
	DescZH    string `json:"descZh"`
	DescEN    string `json:"descEn"`
	Icon      string `json:"icon"`  // Emoji icon
	Color     string `json:"color"` // Color theme
	Order     int    `gorm:"default:0" json:"order"`
	IsActive  bool   `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (BookChapterDB) TableName() string {
	return "book_chapters"
}

// GlowStickDB represents a glow stick (光签) message
type GlowStickDB struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	TenantID  *uint  `gorm:"index" json:"tenantId"`
	TitleZH   string `json:"titleZh"`
	TitleEN   string `json:"titleEn"`
	MessageZH string `gorm:"type:text" json:"messageZh"`
	MessageEN string `gorm:"type:text" json:"messageEn"`
	Color     string `json:"color"`                  // Tailwind gradient classes
	ChapterID string `gorm:"index" json:"chapterId"` // Foreign key to chapter
	ForTypes  string `json:"forTypes"`               // Comma-separated glowtype codes (for personalization)
	Order     int    `gorm:"default:0" json:"order"`
	IsActive  bool   `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (GlowStickDB) TableName() string {
	return "glow_sticks"
}

// ============ Statistics ============

// UsageStats stores anonymous usage statistics (no PII)
type UsageStats struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	TenantID       *uint     `gorm:"index" json:"tenantId"`
	Date           string    `gorm:"index;not null" json:"date"`
	QuizCompleted  int       `json:"quizCompleted"`
	ShareGenerated int       `json:"shareGenerated"`
	AIChatsStarted int       `json:"aiChatsStarted"`
	AIInsightUsed  int       `json:"aiInsightUsed"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func (UsageStats) TableName() string {
	return "usage_stats"
}

// GlowtypeStats tracks glowtype distribution (anonymous)
type GlowtypeStats struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	TenantID  *uint     `gorm:"index" json:"tenantId"`
	Date      string    `gorm:"index;not null" json:"date"`
	TypeCode  string    `gorm:"index;not null" json:"typeCode"`
	Count     int       `json:"count"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (GlowtypeStats) TableName() string {
	return "glowtype_stats"
}

// ============ Admin Users & Security ============

const (
	AdminRoleSuper    = "superadmin"
	AdminRoleStandard = "admin"
	AdminRoleContent  = "content_admin"
	AdminRoleData     = "data_admin"
	AdminRoleAnalyst  = "analyst"
	AdminRoleViewer   = "viewer"
)

// AdminUser represents an authenticated admin account
type AdminUser struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Username     string         `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash string         `json:"-"`
	Role         string         `gorm:"default:admin" json:"role"`
	Permissions  datatypes.JSON `gorm:"type:json" json:"permissions"` // Custom permissions override (null = use role defaults)
	IsActive     bool           `gorm:"default:true" json:"isActive"`
	LastLoginAt  *time.Time     `json:"lastLoginAt"`
	LastLoginIP  string         `json:"lastLoginIp"`
	TokenVersion int            `gorm:"default:1" json:"-"`

	// Two-Factor Authentication fields
	TwoFactorEnabled    bool       `gorm:"default:false" json:"twoFactorEnabled"`
	TwoFactorSecret     string     `json:"-"`                                      // AES-encrypted TOTP secret, never exposed
	TwoFactorVerifiedAt *time.Time `json:"twoFactorVerifiedAt"`                    // When 2FA was first verified/enabled
	TwoFactorRequired   bool       `gorm:"default:false" json:"twoFactorRequired"` // Per-user force 2FA (set by superadmin)

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (AdminUser) TableName() string {
	return "admin_users"
}

// AdminRecoveryCode stores one-time recovery codes for 2FA bypass
type AdminRecoveryCode struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	AdminID   uint       `gorm:"index;not null" json:"adminId"`
	CodeHash  string     `gorm:"not null" json:"-"` // bcrypt hash of the code
	UsedAt    *time.Time `json:"usedAt"`            // null = unused
	CreatedAt time.Time  `json:"createdAt"`
}

func (AdminRecoveryCode) TableName() string {
	return "admin_recovery_codes"
}

// AdminTrustedDevice allows skipping 2FA for trusted devices
type AdminTrustedDevice struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	AdminID     uint       `gorm:"index;not null" json:"adminId"`
	DeviceToken string     `gorm:"uniqueIndex;not null" json:"-"` // Hashed device token
	DeviceName  string     `json:"deviceName"`                    // User-friendly name (e.g., "Chrome on MacBook")
	UserAgent   string     `json:"userAgent"`
	IP          string     `json:"ip"` // IP when device was trusted
	LastUsedAt  *time.Time `json:"lastUsedAt"`
	ExpiresAt   time.Time  `gorm:"index" json:"expiresAt"` // Trust expires after N days (default 7)
	CreatedAt   time.Time  `json:"createdAt"`
}

func (AdminTrustedDevice) TableName() string {
	return "admin_trusted_devices"
}

// AdminLoginAttempt tracks login failures for brute-force protection
type AdminLoginAttempt struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Username    string     `gorm:"index" json:"username"`
	IP          string     `gorm:"index" json:"ip"`
	Attempts    int        `json:"attempts"`
	LastAttempt *time.Time `json:"lastAttempt"`
	LockedUntil *time.Time `json:"lockedUntil"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

func (AdminLoginAttempt) TableName() string {
	return "admin_login_attempts"
}

// AdminAuditLog records admin actions for accountability
type AdminAuditLog struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	AdminID    uint           `gorm:"index" json:"adminId"`
	Username   string         `gorm:"index" json:"username"`
	Action     string         `json:"action"`
	Method     string         `json:"method"`
	Path       string         `gorm:"index" json:"path"`
	IP         string         `json:"ip"`
	StatusCode int            `json:"statusCode"`
	Metadata   datatypes.JSON `gorm:"type:json" json:"metadata"`
	CreatedAt  time.Time      `json:"createdAt"`
}

func (AdminAuditLog) TableName() string {
	return "admin_audit_logs"
}

// ============ AI Settings ============

// AISettings stores AI provider configuration (singleton record with id=1)
type AISettings struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Provider string `gorm:"default:openai" json:"provider"` // openai, mock
	APIKey   string `json:"-"`                              // Never expose in JSON
	BaseURL  string `json:"baseUrl"`
	Model    string `json:"model"`
	IsActive bool   `gorm:"default:true" json:"isActive"`
	// Simple anti-abuse controls for anonymous AI endpoints
	RateLimitEnabled        bool      `gorm:"default:true" json:"rateLimitEnabled"`
	RateLimitRequestsPerMin int       `gorm:"default:60" json:"rateLimitRequestsPerMin"`
	RateLimitBurst          int       `gorm:"default:10" json:"rateLimitBurst"`
	UpdatedAt               time.Time `json:"updatedAt"`
}

func (AISettings) TableName() string {
	return "ai_settings"
}

// GetAISettings returns the singleton AI settings record, creating default if not exists
func GetAISettings(db *gorm.DB) (*AISettings, error) {
	var settings AISettings
	err := db.First(&settings, 1).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Create default settings
			settings = AISettings{
				ID:                      1,
				Provider:                "openai",
				BaseURL:                 "https://api.openai.com/v1",
				Model:                   "gpt-4o-mini",
				IsActive:                false, // Disabled by default until configured
				RateLimitEnabled:        true,
				RateLimitRequestsPerMin: 60,
				RateLimitBurst:          10,
			}
			if err := db.Create(&settings).Error; err != nil {
				return nil, err
			}
			return &settings, nil
		}
		return nil, err
	}
	return &settings, nil
}

// ============ Analytics Cache ============

// AnalyticsCacheDB stores pre-computed analytics results for performance
type AnalyticsCacheDB struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	TenantID      *uint          `gorm:"index" json:"tenantId"`
	CacheKey      string         `gorm:"uniqueIndex;not null" json:"cacheKey"` // e.g., "analytics:30d:tenant_1"
	DateRangeType string         `gorm:"index" json:"dateRangeType"`           // "30d", "90d", "all", "custom"
	StartDate     string         `json:"startDate"`
	EndDate       string         `json:"endDate"`

	// Cached computation results (JSON)
	SummaryData       datatypes.JSON `gorm:"type:json" json:"summaryData"`
	DimensionStats    datatypes.JSON `gorm:"type:json" json:"dimensionStats"`
	ReliabilityStats  datatypes.JSON `gorm:"type:json" json:"reliabilityStats"`
	ValidityStats       datatypes.JSON `gorm:"type:json" json:"validityStats"`       // AVE, CR, HTMT validity analysis
	GroupComparisonData datatypes.JSON `gorm:"type:json" json:"groupComparisonData"` // t-test, ANOVA group comparisons
	AdvancedStats       datatypes.JSON `gorm:"type:json" json:"advancedStats"`       // Skewness, kurtosis, etc.
	TrendData         datatypes.JSON `gorm:"type:json" json:"trendData"`
	SegmentData       datatypes.JSON `gorm:"type:json" json:"segmentData"`
	CorrelationMatrix datatypes.JSON `gorm:"type:json" json:"correlationMatrix"`

	// Cache metadata
	SampleCount  int       `json:"sampleCount"`
	LastResultID uint      `gorm:"index" json:"lastResultId"` // For incremental updates
	ComputedAt   time.Time `gorm:"index" json:"computedAt"`
	ExpiresAt    time.Time `gorm:"index" json:"expiresAt"`
	IsStale      bool      `gorm:"default:false" json:"isStale"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (AnalyticsCacheDB) TableName() string {
	return "analytics_cache"
}
