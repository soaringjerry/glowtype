package services

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/soaringjerry/glowtype/internal/models"
)

type ChatService struct {
	sessions map[string]time.Time
	mu       sync.Mutex
}

func NewChatService() *ChatService {
	return &ChatService{
		sessions: make(map[string]time.Time),
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

	reply := fmt.Sprintf("%sI hear that you are going through something difficult. This space is for gentle reflection, not diagnosis.", prefix)
	if req.Language == "zh-CN" {
		reply = fmt.Sprintf("%s听起来你最近不太容易。这里是一个轻松聊聊情绪的地方，不是专业诊断。", prefix)
	}

	var safety *string
	if req.Language == "zh-CN" {
		text := "如果你有强烈自伤或伤人的想法，请优先联系身边可信任的成年人或紧急热线。"
		safety = &text
	} else {
		text := "If you ever feel unsafe or in crisis, please reach out to a trusted adult or local crisis hotline."
		safety = &text
	}

	return models.ChatMessageResponse{
		Reply:        reply,
		SafetyNotice: safety,
	}
}

