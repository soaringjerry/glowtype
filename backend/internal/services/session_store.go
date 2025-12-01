package services

import (
	"sync"
	"time"
)

// Crisis level constants
const (
	CrisisLevelNone = 0 // No risk (internal default)
	CrisisLevelLow  = 1 // Low concern
	CrisisLevelMid  = 2 // Moderate risk
	CrisisLevelHigh = 3 // High risk
)

// Session TTL and limits
const (
	SessionTTL                = 60 * time.Minute // 60 min (teens type slow / switch apps)
	MaxHistoryLength          = 10               // Max messages to keep in history
	CleanupInterval           = 5 * time.Minute  // Background cleanup interval
	MaxResourceShowPerSession = 2                // Max times to show resources per session
)

// SessionContext holds rich context for a chat session
type SessionContext struct {
	// Glowtype info
	GlowtypeCode    string             `json:"glowtypeCode"`
	GlowtypeName    string             `json:"glowtypeName"`    // Localized name
	DimensionScores map[string]float64 `json:"dimensionScores"` // e.g., {"energy": 2.5, "expression": -1.5}
	Language        string             `json:"language"`

	// Timing
	CreatedAt    time.Time `json:"createdAt"`
	LastActivity time.Time `json:"lastActivity"`

	// Message tracking
	MessageCount int `json:"messageCount"`

	// Crisis tracking
	CrisisDetected   bool `json:"crisisDetected"`   // Flag if crisis ever detected
	HighestRiskLevel int  `json:"highestRiskLevel"` // Track highest risk seen

	// Resource display control
	ResourceShownCount int  `json:"resourceShownCount"` // Times resources shown this session
	ResourceShownAt    *int `json:"resourceShownAt"`    // Message index when last shown
	ResourceDeclined   bool `json:"resourceDeclined"`   // User said "stop mentioning"

	// Test data marking
	IsTest bool `json:"isTest"` // Mark as test data (admin sessions)

	// Debug: last API request payload (for debugging)
	LastAPIRequest map[string]any `json:"lastApiRequest,omitempty"`

	// Debug: last RAG retrieval info
	LastRAG *RAGDebugInfo `json:"lastRag,omitempty"`
}

// RAGDebugInfo captures retrieval details for the last message
type RAGDebugInfo struct {
	Message     string           `json:"message"`
	Language    string           `json:"language"`
	CrisisLevel int              `json:"crisisLevel"`
	Retrieved   []RAGScriptDebug `json:"retrieved"`
	Error       string           `json:"error,omitempty"`
}

// RAGScriptDebug summarizes an individual retrieved script
type RAGScriptDebug struct {
	ID              uint     `json:"id"`
	Title           string   `json:"title"`
	Language        string   `json:"language,omitempty"`
	CrisisLevels    string   `json:"crisisLevels,omitempty"`
	Score           float32  `json:"score"`
	TriggerKeywords []string `json:"triggerKeywords,omitempty"`
}

// SessionStore manages in-memory session contexts with automatic cleanup
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*SessionContext
	ttl      time.Duration
	stopChan chan struct{}
}

// NewSessionStore creates a new session store with the given TTL
func NewSessionStore(ttl time.Duration) *SessionStore {
	if ttl == 0 {
		ttl = SessionTTL
	}
	store := &SessionStore{
		sessions: make(map[string]*SessionContext),
		ttl:      ttl,
		stopChan: make(chan struct{}),
	}
	go store.cleanup()
	return store
}

// Create stores a new session context
func (s *SessionStore) Create(sessionID string, ctx *SessionContext) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	ctx.CreatedAt = now
	ctx.LastActivity = now
	s.sessions[sessionID] = ctx
}

// Get retrieves session context (returns nil if not found or expired)
func (s *SessionStore) Get(sessionID string) (*SessionContext, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ctx, ok := s.sessions[sessionID]
	if !ok {
		return nil, false
	}

	// Check if expired
	if time.Since(ctx.LastActivity) > s.ttl {
		return nil, false
	}

	return ctx, true
}

// Touch updates last activity timestamp (call on each message)
func (s *SessionStore) Touch(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ctx, ok := s.sessions[sessionID]; ok {
		ctx.LastActivity = time.Now()
	}
}

// IncrementMessageCount increments the message counter and returns new count
func (s *SessionStore) IncrementMessageCount(sessionID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ctx, ok := s.sessions[sessionID]; ok {
		ctx.MessageCount++
		ctx.LastActivity = time.Now()
		return ctx.MessageCount
	}
	return 0
}

// SetCrisisLevel records crisis detection level
func (s *SessionStore) SetCrisisLevel(sessionID string, level int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ctx, ok := s.sessions[sessionID]; ok {
		if level > 0 {
			ctx.CrisisDetected = true
		}
		if level > ctx.HighestRiskLevel {
			ctx.HighestRiskLevel = level
		}
	}
}

// RecordResourceShown marks that resources were shown at this message
func (s *SessionStore) RecordResourceShown(sessionID string, messageIndex int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ctx, ok := s.sessions[sessionID]; ok {
		ctx.ResourceShownCount++
		ctx.ResourceShownAt = &messageIndex
	}
}

// SetResourceDeclined marks that user declined resources
func (s *SessionStore) SetResourceDeclined(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ctx, ok := s.sessions[sessionID]; ok {
		ctx.ResourceDeclined = true
	}
}

// ShouldShowResources checks if we should show resources based on frequency limits
func (s *SessionStore) ShouldShowResources(sessionID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ctx, ok := s.sessions[sessionID]
	if !ok {
		return true // New session, can show
	}

	// User explicitly declined
	if ctx.ResourceDeclined {
		return false
	}

	// Already shown max times
	if ctx.ResourceShownCount >= MaxResourceShowPerSession {
		return false
	}

	return true
}

// SetLastAPIRequest stores the last API request payload for debugging
func (s *SessionStore) SetLastAPIRequest(sessionID string, request map[string]any) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ctx, ok := s.sessions[sessionID]; ok {
		ctx.LastAPIRequest = request
	}
}

// SetLastRAG stores details about the latest RAG retrieval
func (s *SessionStore) SetLastRAG(sessionID string, info *RAGDebugInfo) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ctx, ok := s.sessions[sessionID]; ok {
		ctx.LastRAG = info
	}
}

// Delete removes a session
func (s *SessionStore) Delete(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
}

// cleanup runs in background and removes expired sessions
func (s *SessionStore) cleanup() {
	ticker := time.NewTicker(CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.removeExpired()
		case <-s.stopChan:
			return
		}
	}
}

// removeExpired removes all expired sessions
func (s *SessionStore) removeExpired() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for id, ctx := range s.sessions {
		if now.Sub(ctx.LastActivity) > s.ttl {
			delete(s.sessions, id)
		}
	}
}

// Stop stops the background cleanup goroutine
func (s *SessionStore) Stop() {
	close(s.stopChan)
}

// Count returns the number of active sessions (for monitoring)
func (s *SessionStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.sessions)
}
