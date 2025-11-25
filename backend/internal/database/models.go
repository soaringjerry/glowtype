package database

import (
	"time"

	"gorm.io/datatypes"
)

// ============ Multi-tenant Support ============

// TenantID is nullable: nil = public/global, non-nil = org-specific
// This allows same system to serve public users + institutional deployments

// ============ Trait Dimensions ============

// TraitDimensionDB defines bipolar scoring dimensions (like MBTI's E-I, S-N, T-F, J-P)
type TraitDimensionDB struct {
	ID           uint    `gorm:"primaryKey" json:"id"`
	TenantID     *uint   `gorm:"index" json:"tenantId"` // nil = global
	Key          string  `gorm:"uniqueIndex:idx_tenant_key;not null" json:"key"` // e.g., "energy"
	NameZH       string  `json:"nameZh"`
	NameEN       string  `json:"nameEn"`
	PositivePole string  `json:"positivePole"` // e.g., "extrovert" (score > 0)
	NegativePole string  `json:"negativePole"` // e.g., "introvert" (score < 0)
	Description  string  `gorm:"type:text" json:"description"`

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
	Name        string `json:"name"`
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
	ID        uint   `gorm:"primaryKey" json:"id"`
	TenantID  *uint  `gorm:"index" json:"tenantId"`
	SessionID string `gorm:"index;not null" json:"sessionId"` // Anonymous session identifier

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

	// Traffic attribution (for marketing analysis)
	Channel    string `gorm:"index" json:"channel"`    // Distribution channel: "wechat", "linkedin", "organic", etc.
	EntryPoint string `json:"entryPoint"`              // Specific campaign/source: "homepage", "blog_post_1", "ad_campaign_q1"
	Referrer   string `json:"referrer"`                // HTTP referer (if available)

	CreatedAt time.Time `json:"createdAt"`
}

func (QuizResultDB) TableName() string {
	return "quiz_results"
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
	ID       uint   `gorm:"primaryKey" json:"id"`
	TenantID *uint  `gorm:"index" json:"tenantId"`
	Key      string `gorm:"uniqueIndex:idx_tenant_prompt;not null" json:"key"`
	Name     string `json:"name"`
	Content  string `gorm:"type:text;not null" json:"content"`

	Version  int  `gorm:"default:1" json:"version"`
	IsActive bool `gorm:"default:true" json:"isActive"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (AIPromptDB) TableName() string {
	return "ai_prompts"
}

// ============ Statistics ============

// UsageStats stores anonymous usage statistics (no PII)
type UsageStats struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	TenantID       *uint  `gorm:"index" json:"tenantId"`
	Date           string `gorm:"index;not null" json:"date"`
	QuizCompleted  int    `json:"quizCompleted"`
	ShareGenerated int    `json:"shareGenerated"`
	AIChatsStarted int    `json:"aiChatsStarted"`
	AIInsightUsed  int    `json:"aiInsightUsed"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func (UsageStats) TableName() string {
	return "usage_stats"
}

// GlowtypeStats tracks glowtype distribution (anonymous)
type GlowtypeStats struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	TenantID  *uint  `gorm:"index" json:"tenantId"`
	Date      string `gorm:"index;not null" json:"date"`
	TypeCode  string `gorm:"index;not null" json:"typeCode"`
	Count     int    `json:"count"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (GlowtypeStats) TableName() string {
	return "glowtype_stats"
}
