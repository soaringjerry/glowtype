package services

import (
	"bytes"
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
	envAPIKey   string
	envBaseURL  string
	envModel    string
	client      *http.Client
	db          *gorm.DB
}

// aiConfig holds the effective AI configuration
type aiConfig struct {
	provider string
	apiKey   string
	baseURL  string
	model    string
}

const defaultOpenAIBase = "https://api.openai.com/v1"

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

	return &ChatService{
		sessions:   make(map[string]time.Time),
		provider:   provider,
		envAPIKey:  apiKey,
		envBaseURL: baseURL,
		envModel:   model,
		client:     &http.Client{Timeout: 30 * time.Second},
		db:         db,
	}
}

// getEffectiveConfig returns AI configuration, prioritizing DB settings over environment variables
func (s *ChatService) getEffectiveConfig() aiConfig {
	// Try to get config from database first
	if s.db != nil {
		dbSettings, err := database.GetAISettings(s.db)
		if err == nil && dbSettings != nil && dbSettings.IsActive && dbSettings.APIKey != "" {
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
				provider: dbSettings.Provider,
				apiKey:   dbSettings.APIKey,
				baseURL:  baseURL,
				model:    model,
			}
		}
	}

	// Fall back to environment config
	return aiConfig{
		provider: s.provider,
		apiKey:   s.envAPIKey,
		baseURL:  s.envBaseURL,
		model:    s.envModel,
	}
}

func (s *ChatService) CreateSession(_ models.ChatSessionRequest) models.ChatSessionResponse {
	id := uuid.New().String()

	s.mu.Lock()
	s.sessions[id] = time.Now()
	s.mu.Unlock()

	return models.ChatSessionResponse{SessionID: id}
}

func (s *ChatService) Reply(req models.ChatMessageRequest) models.ChatMessageResponse {
	s.mu.Lock()
	_, exists := s.sessions[req.SessionID]
	s.mu.Unlock()

	// Very lightweight safety guardrail: if no session, still respond but hint.
	var prefix string
	if !exists {
		prefix = "This is a temporary anonymous chat. "
		if req.Language == "zh-CN" {
			prefix = "这是一个临时的匿名聊天窗口。"
		}
	}

	// Get effective AI config (DB first, then env fallback)
	cfg := s.getEffectiveConfig()

	// Provider-backed AI reply
	if cfg.provider == "openai" && cfg.apiKey != "" {
		aiReply, err := s.callOpenAIChat(cfg, req.Message, req.Language)
		if err != nil {
			log.Printf("[ChatService] Reply: OpenAI call failed: %v", err)
		} else if aiReply != "" {
			return models.ChatMessageResponse{
				Reply:        aiReply,
				SafetyNotice: safetyNotice(req.Language),
			}
		}
	} else {
		log.Printf("[ChatService] Reply: skipping AI (provider=%q, hasKey=%v)", cfg.provider, cfg.apiKey != "")
	}

	reply := fmt.Sprintf("%sI hear that you are going through something difficult. This space is for gentle reflection, not diagnosis.", prefix)
	if req.Language == "zh-CN" || req.Language == "zh" {
		reply = fmt.Sprintf("%s听起来你最近不太容易。这里是一个轻松聊聊情绪的地方，不是专业诊断。", prefix)
	}

	return models.ChatMessageResponse{
		Reply:        reply,
		SafetyNotice: safetyNotice(req.Language),
	}
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
		json.NewDecoder(resp.Body).Decode(&errBody)
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
