package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/soaringjerry/glowtype/internal/config"
	"github.com/soaringjerry/glowtype/internal/models"
)

type ChatService struct {
	sessions map[string]time.Time
	mu       sync.Mutex
	provider string

	openAIKey   string
	openAIBase  string
	openAIModel string
	client      *http.Client
}

func NewChatService(cfg config.Config) *ChatService {
	return &ChatService{
		sessions:    make(map[string]time.Time),
		provider:    strings.ToLower(strings.TrimSpace(cfg.ChatProvider)),
		openAIKey:   strings.TrimSpace(cfg.OpenAIAPIKey),
		openAIBase:  strings.TrimRight(strings.TrimSpace(cfg.OpenAIBaseURL), "/"),
		openAIModel: strings.TrimSpace(cfg.OpenAIModel),
		client:      &http.Client{Timeout: 15 * time.Second},
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

	// Provider-backed AI reply
	if s.provider == "openai" && s.openAIKey != "" {
		if aiReply, err := s.callOpenAIChat(req.Message, req.Language); err == nil && aiReply != "" {
			return models.ChatMessageResponse{
				Reply:        aiReply,
				SafetyNotice: safetyNotice(req.Language),
			}
		}
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
	if s.provider == "openai" && s.openAIKey != "" {
		if aiReply, err := s.callOpenAI([]openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		}); err == nil && aiReply != "" {
			return aiReply
		}
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

func (s *ChatService) callOpenAIChat(message, lang string) (string, error) {
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

	return s.callOpenAI([]openAIMessage{
		{Role: "system", Content: system},
		{Role: "user", Content: message},
	})
}

func (s *ChatService) callOpenAI(messages []openAIMessage) (string, error) {
	body := map[string]any{
		"model":    s.openAIModel,
		"messages": messages,
	}

	payload, _ := json.Marshal(body)

	req, err := http.NewRequest(http.MethodPost, s.openAIBase+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.openAIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openai status %d", resp.StatusCode)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices")
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
