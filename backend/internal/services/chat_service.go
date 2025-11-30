package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/soaringjerry/glowtype/internal/config"
	"github.com/soaringjerry/glowtype/internal/database"
	"github.com/soaringjerry/glowtype/internal/models"
	"gorm.io/gorm"
)

type ChatService struct {
	sessions map[string]time.Time
	mu       sync.Mutex
	provider string

	// Fallback config from environment (used when DB config not available)
	envAPIKey  string
	envBaseURL string
	envModel   string
	client     *http.Client
	db         *gorm.DB

	rateLimiter *ipRateLimiter

	// New components for emotion companion features
	sessionStore   *SessionStore
	crisisDetector *CrisisDetector
	resourceSvc    *ResourceService
	promptBuilder  *PromptBuilder
	alertService   *CrisisAlertService
}

// aiConfig holds the effective AI configuration
type aiConfig struct {
	provider  string
	apiKey    string
	baseURL   string
	model     string
	rateLimit rateLimitConfig
}

const defaultOpenAIBase = "https://api.openai.com/v1"
const (
	defaultRateLimitPerMinute = 60
	defaultRateLimitBurst     = 10
)

func NewChatService(cfg config.Config, db *gorm.DB) *ChatService {
	provider := strings.ToLower(strings.TrimSpace(cfg.ChatProvider))
	apiKey := strings.TrimSpace(cfg.OpenAIAPIKey)
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.OpenAIBaseURL), "/")
	model := strings.TrimSpace(cfg.OpenAIModel)

	// If an API key is present, default to the OpenAI provider even if CHAT_PROVIDER was left as mock/empty.
	if apiKey != "" && provider != "openai" {
		log.Printf("[ChatService] OpenAI API key detected, switching provider from %q to \"openai\"", provider)
		provider = "openai"
	}

	if provider == "" {
		provider = "mock"
	}

	// Default base URL if not set
	if baseURL == "" {
		baseURL = defaultOpenAIBase
	}
	// Default model if not set
	if model == "" {
		model = "gpt-4o-mini"
	}

	// Log config on startup
	keyPreview := ""
	if len(apiKey) > 8 {
		keyPreview = apiKey[:4] + "..." + apiKey[len(apiKey)-4:]
	} else if apiKey != "" {
		keyPreview = "***"
	}
	log.Printf("[ChatService] provider=%q, baseURL=%q, model=%q, apiKey=%q (env fallback)", provider, baseURL, model, keyPreview)

	if provider == "openai" && apiKey == "" {
		log.Printf("[ChatService] WARNING: provider=openai but OPENAI_API_KEY is empty!")
	}

	// Initialize new components with database-backed configuration (supports hot-reload)
	sessionStore := NewSessionStore(SessionTTL)

	// Use database-backed crisis detector for hot-reload support
	crisisDetector := NewCrisisDetectorWithDB(db)

	// ResourceService and PromptBuilder now use the shared config loader
	configLoader := crisisDetector.GetConfigLoader()
	resourceSvc := NewResourceServiceWithDB(configLoader)
	promptBuilder := NewPromptBuilderWithDB(configLoader)
	alertService := NewCrisisAlertService(db, configLoader)

	log.Printf("[ChatService] Emotion companion components initialized with DB-backed config (hot-reload enabled)")

	return &ChatService{
		sessions:       make(map[string]time.Time),
		provider:       provider,
		envAPIKey:      apiKey,
		envBaseURL:     baseURL,
		envModel:       model,
		client:         &http.Client{Timeout: 30 * time.Second},
		db:             db,
		rateLimiter:    newIPRateLimiter(),
		sessionStore:   sessionStore,
		crisisDetector: crisisDetector,
		resourceSvc:    resourceSvc,
		promptBuilder:  promptBuilder,
		alertService:   alertService,
	}
}

// getEffectiveConfig returns AI configuration, prioritizing DB settings over environment variables
func (s *ChatService) getEffectiveConfig() aiConfig {
	rateCfg := rateLimitConfig{
		enabled:   true,
		perMinute: defaultRateLimitPerMinute,
		burst:     defaultRateLimitBurst,
	}

	// Try to get config from database first (rate limits always respected from DB even if AI is inactive)
	if s.db != nil {
		dbSettings, err := database.GetAISettings(s.db)
		if err == nil && dbSettings != nil {
			rateCfg = buildRateLimitConfig(dbSettings)

			if dbSettings.IsActive && strings.TrimSpace(dbSettings.APIKey) != "" {
				baseURL := strings.TrimRight(strings.TrimSpace(dbSettings.BaseURL), "/")
				if baseURL == "" {
					baseURL = defaultOpenAIBase
				}
				model := strings.TrimSpace(dbSettings.Model)
				if model == "" {
					model = "gpt-4o-mini"
				}
				log.Printf("[ChatService] Using DB AI config: provider=%q, model=%q", dbSettings.Provider, model)
				return aiConfig{
					provider:  dbSettings.Provider,
					apiKey:    dbSettings.APIKey,
					baseURL:   baseURL,
					model:     model,
					rateLimit: rateCfg,
				}
			}
		}
	}

	// Fall back to environment config
	return aiConfig{
		provider:  s.provider,
		apiKey:    s.envAPIKey,
		baseURL:   s.envBaseURL,
		model:     s.envModel,
		rateLimit: rateCfg,
	}
}

func (s *ChatService) CreateSession(req models.ChatSessionRequest) models.ChatSessionResponse {
	id := uuid.New().String()

	s.mu.Lock()
	s.sessions[id] = time.Now()
	s.mu.Unlock()

	// Store rich context in SessionStore
	sessionCtx := &SessionContext{
		GlowtypeCode:    req.GlowtypeCode,
		GlowtypeName:    req.GlowtypeID, // GlowtypeID is the localized name
		DimensionScores: req.DimensionScores,
		Language:        req.Language,
		IsTest:          req.IsTest,
	}
	s.sessionStore.Create(id, sessionCtx)

	log.Printf("[ChatService] Session created: id=%s, glowtype=%s, lang=%s",
		id, req.GlowtypeCode, req.Language)

	return models.ChatSessionResponse{SessionID: id}
}

func (s *ChatService) Reply(req models.ChatMessageRequest) models.ChatMessageResponse {
	s.mu.Lock()
	_, exists := s.sessions[req.SessionID]
	s.mu.Unlock()

	// Get session context (may be nil for anonymous sessions)
	sessionCtx, hasSessionCtx := s.sessionStore.Get(req.SessionID)
	if hasSessionCtx {
		s.sessionStore.Touch(req.SessionID)
	}

	// Very lightweight safety guardrail: if no session, still respond but hint.
	var prefix string
	if !exists && !hasSessionCtx {
		prefix = "This is a temporary anonymous chat. "
		if req.Language == "zh-CN" {
			prefix = "这是一个临时的匿名聊天窗口。"
		}
	}

	// Increment message count
	messageIndex := 0
	if hasSessionCtx {
		messageIndex = s.sessionStore.IncrementMessageCount(req.SessionID)
	}

	// Convert models.ChatHistoryItem to services.ChatHistoryItem for crisis detection
	var history []ChatHistoryItem
	for _, h := range req.History {
		history = append(history, ChatHistoryItem{Role: h.Role, Content: h.Content})
	}

	// Run crisis detection
	crisisResult := s.crisisDetector.Detect(context.Background(), req.Message, history)

	// Check if user is declining resources
	if s.crisisDetector.DetectsResourceDecline(req.Message) {
		s.sessionStore.SetResourceDeclined(req.SessionID)
		log.Printf("[ChatService] User declined resources: session=%s", req.SessionID)
	}

	// Update session with crisis level
	if hasSessionCtx && crisisResult.Level > 0 {
		s.sessionStore.SetCrisisLevel(req.SessionID, crisisResult.Level)
	}

	// Determine if we should show resources
	var resources []models.CrisisResource
	showResources := crisisResult.Level >= CrisisLevelMid &&
		crisisResult.NeedsResponse &&
		s.sessionStore.ShouldShowResources(req.SessionID)

	if showResources {
		// Get appropriate resources
		region := "" // Could be extracted from user agent or settings in future
		svcResources := s.resourceSvc.GetResources(req.Language, region, crisisResult.Level)

		// Convert to models.CrisisResource
		for _, r := range svcResources {
			resources = append(resources, models.CrisisResource{
				Name:   r.Name,
				Phone:  r.Phone,
				URL:    r.URL,
				Region: r.Region,
			})
		}

		// Record that resources were shown
		s.sessionStore.RecordResourceShown(req.SessionID, messageIndex)
	}

	// Log crisis event for research (anonymous)
	if crisisResult.Level >= CrisisLevelMid && s.db != nil {
		s.logCrisisEvent(req.SessionID, sessionCtx, crisisResult, messageIndex)
	}

	// Send Level 3 alert if configured
	if crisisResult.Level == CrisisLevelHigh && s.alertService != nil {
		glowtypeCode := ""
		if hasSessionCtx {
			glowtypeCode = sessionCtx.GlowtypeCode
		}
		s.alertService.SendLevel3Alert(CrisisAlertPayload{
			SessionID:       req.SessionID,
			Level:           crisisResult.Level,
			Triggers:        crisisResult.Triggers,
			TriggerCategory: crisisResult.TriggerCategory,
			Message:         req.Message,
			Glowtype:        glowtypeCode,
			Language:        req.Language,
			DetectedAt:      time.Now(),
		})
	}

	// Get effective AI config (DB first, then env fallback)
	cfg := s.getEffectiveConfig()

	// Build personalized system prompt
	glowtypeCtx := GlowtypeContext{
		Language: req.Language,
	}
	resourcesDeclined := false
	if hasSessionCtx {
		glowtypeCtx.Code = sessionCtx.GlowtypeCode
		glowtypeCtx.LocalizedName = sessionCtx.GlowtypeName
		glowtypeCtx.DimensionScores = sessionCtx.DimensionScores
		resourcesDeclined = sessionCtx.ResourceDeclined
	}

	systemPrompt := s.promptBuilder.BuildSystemPrompt(glowtypeCtx, crisisResult.Level, resourcesDeclined)

	// Provider-backed AI reply
	if cfg.provider == "openai" && cfg.apiKey != "" {
		aiReply, err := s.callOpenAIWithSystem(cfg, systemPrompt, req.Message, history)
		if err != nil {
			log.Printf("[ChatService] Reply: OpenAI call failed: %v", err)
		} else if aiReply != "" {
			return models.ChatMessageResponse{
				Reply:        aiReply,
				SafetyNotice: safetyNotice(req.Language),
				CrisisLevel:  crisisResult.Level,
				Resources:    resources,
			}
		}
	} else {
		log.Printf("[ChatService] Reply: skipping AI (provider=%q, hasKey=%v)", cfg.provider, cfg.apiKey != "")
	}

	// Fallback response
	reply := fmt.Sprintf("%sI hear that you are going through something difficult. This space is for gentle reflection, not diagnosis.", prefix)
	if req.Language == "zh-CN" || req.Language == "zh" {
		reply = fmt.Sprintf("%s听起来你最近不太容易。这里是一个轻松聊聊情绪的地方，不是专业诊断。", prefix)
	}

	return models.ChatMessageResponse{
		Reply:        reply,
		SafetyNotice: safetyNotice(req.Language),
		CrisisLevel:  crisisResult.Level,
		Resources:    resources,
	}
}

// logCrisisEvent logs a crisis event to the database for research purposes
func (s *ChatService) logCrisisEvent(sessionID string, ctx *SessionContext, result CrisisResult, messageIndex int) {
	glowtypeCode := ""
	language := ""
	totalMessages := 0
	isTest := false

	if ctx != nil {
		glowtypeCode = ctx.GlowtypeCode
		language = ctx.Language
		totalMessages = ctx.MessageCount
		isTest = ctx.IsTest
	}

	event := database.CrisisEventDB{
		SessionID:       sessionID,
		GlowtypeCode:    glowtypeCode,
		Language:        language,
		RiskLevel:       result.Level,
		TriggerCategory: result.TriggerCategory,
		Via:             result.Via,
		MessageIndex:    messageIndex,
		TotalMessages:   totalMessages,
		IsTest:          isTest,
	}

	if err := s.db.Create(&event).Error; err != nil {
		log.Printf("[ChatService] Failed to log crisis event: %v", err)
	} else {
		log.Printf("[ChatService] Crisis event logged: level=%d, category=%s, via=%s",
			result.Level, result.TriggerCategory, result.Via)
	}
}

// callOpenAIWithSystem calls OpenAI with a custom system prompt and conversation history
func (s *ChatService) callOpenAIWithSystem(cfg aiConfig, systemPrompt, message string, history []ChatHistoryItem) (string, error) {
	messages := []openAIMessage{
		{Role: "system", Content: systemPrompt},
	}

	// Add conversation history (limited to recent messages)
	maxHistory := 10
	start := 0
	if len(history) > maxHistory {
		start = len(history) - maxHistory
	}
	for _, h := range history[start:] {
		messages = append(messages, openAIMessage{Role: h.Role, Content: h.Content})
	}

	// Add current user message
	messages = append(messages, openAIMessage{Role: "user", Content: message})

	return s.callOpenAI(cfg, messages)
}

// GenerateInsight returns a concise insight via provider (OpenAI) if configured, otherwise a static fallback.
func (s *ChatService) GenerateInsight(systemPrompt, userPrompt, lang string) string {
	// Get effective AI config (DB first, then env fallback)
	cfg := s.getEffectiveConfig()

	if cfg.provider == "openai" && cfg.apiKey != "" {
		aiReply, err := s.callOpenAI(cfg, []openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		})
		if err != nil {
			log.Printf("[ChatService] GenerateInsight: OpenAI call failed: %v", err)
		} else if aiReply != "" {
			return aiReply
		}
	} else {
		log.Printf("[ChatService] GenerateInsight: skipping AI (provider=%q, hasKey=%v)", cfg.provider, cfg.apiKey != "")
	}

	if lang == "zh" || lang == "zh-CN" {
		return "这是一个简短的温柔提示：照顾好自己，你的感受值得被倾听。"
	}
	return "This is a gentle reminder: take care of yourself, your feelings deserve to be heard."
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func (s *ChatService) callOpenAIChat(cfg aiConfig, message, lang string) (string, error) {
	system := `You are Glowtype AI, a warm and supportive companion. You listen with empathy and respond gently.
Guidelines:
- Keep responses short (2-3 sentences max)
- Be warm, understanding, and non-judgmental
- Do not provide medical advice or diagnoses
- If someone mentions self-harm or crisis, gently encourage them to seek local crisis support`
	if strings.HasPrefix(lang, "zh") {
		system = `你是 Glowtype AI，一个温暖且支持性的陪伴者。用同理心倾听，温柔回应。
准则：
- 回复保持简短（最多2-3句话）
- 温暖、理解、不评判
- 不提供医疗建议或诊断
- 如果有人提到自我伤害或危机，温柔地鼓励他们寻求本地危机支持。`
	}

	return s.callOpenAI(cfg, []openAIMessage{
		{Role: "system", Content: system},
		{Role: "user", Content: message},
	})
}

func (s *ChatService) callOpenAI(cfg aiConfig, messages []openAIMessage) (string, error) {
	body := map[string]any{
		"model":    cfg.model,
		"messages": messages,
	}

	payload, _ := json.Marshal(body)
	url := cfg.baseURL + "/chat/completions"

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("http request to %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Read error body for more details
		var errBody map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&errBody); err != nil {
			return "", fmt.Errorf("openai status %d: failed to decode error body: %w", resp.StatusCode, err)
		}
		return "", fmt.Errorf("openai status %d: %v", resp.StatusCode, errBody)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}

func safetyNotice(lang string) *string {
	if lang == "zh" || lang == "zh-CN" {
		text := "如果你有强烈自伤或伤人的想法，请优先联系身边可信任的成年人或紧急热线。"
		return &text
	}
	text := "If you ever feel unsafe or in crisis, please reach out to a trusted adult or local crisis hotline."
	return &text
}

// Allow checks whether the caller identified by key (IP) can proceed under current rate limits.
func (s *ChatService) Allow(key string) bool {
	cfg := s.getEffectiveConfig().rateLimit
	return s.rateLimiter.allow(key, cfg)
}

type rateLimitConfig struct {
	enabled   bool
	perMinute int
	burst     int
}

func buildRateLimitConfig(settings *database.AISettings) rateLimitConfig {
	cfg := rateLimitConfig{
		enabled:   settings.RateLimitEnabled,
		perMinute: settings.RateLimitRequestsPerMin,
		burst:     settings.RateLimitBurst,
	}
	if cfg.perMinute <= 0 {
		cfg.perMinute = defaultRateLimitPerMinute
	}
	if cfg.burst <= 0 {
		cfg.burst = defaultRateLimitBurst
	}
	return cfg
}

type ipRateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*limiterState
}

type limiterState struct {
	tokens float64
	last   time.Time
}

func newIPRateLimiter() *ipRateLimiter {
	return &ipRateLimiter{
		limiters: make(map[string]*limiterState),
	}
}

func (r *ipRateLimiter) allow(key string, cfg rateLimitConfig) bool {
	if key == "" {
		key = "unknown"
	}
	if !cfg.enabled {
		return true
	}

	if cfg.burst < 1 {
		cfg.burst = cfg.perMinute
	}
	if cfg.burst < 1 {
		cfg.burst = 1
	}
	refillRate := float64(cfg.perMinute) / 60.0 // tokens per second

	r.mu.Lock()
	defer r.mu.Unlock()

	state, ok := r.limiters[key]
	now := time.Now()
	if !ok {
		state = &limiterState{tokens: float64(cfg.burst), last: now}
		r.limiters[key] = state
	} else {
		elapsed := now.Sub(state.last).Seconds()
		state.tokens += elapsed * refillRate
		if state.tokens > float64(cfg.burst) {
			state.tokens = float64(cfg.burst)
		}
		state.last = now
	}

	if state.tokens < 1 {
		return false
	}

	state.tokens -= 1
	return true
}
