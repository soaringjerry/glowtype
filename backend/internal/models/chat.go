package models

// ChatSessionRequest is the request to create a new chat session
type ChatSessionRequest struct {
	Language        string             `json:"language"`
	GlowtypeID      string             `json:"glowtypeId"`
	GlowtypeCode    string             `json:"glowtypeCode,omitempty"`    // NEW: e.g., "radiant-nebula"
	DimensionScores map[string]float64 `json:"dimensionScores,omitempty"` // NEW: e.g., {"energy": 2.5, "expression": -1.5}
	IsTest          bool               `json:"isTest,omitempty"`          // Mark as test data (admin sessions)
}

// ChatSessionResponse is the response when creating a session
type ChatSessionResponse struct {
	SessionID string `json:"sessionId"`
}

// ChatHistoryItem represents a message in conversation history
type ChatHistoryItem struct {
	Role    string `json:"role"`    // "user" or "assistant"
	Content string `json:"content"`
}

// ChatMessageRequest is the request to send a message
type ChatMessageRequest struct {
	SessionID string            `json:"sessionId"`
	Message   string            `json:"message"`
	Language  string            `json:"language"`
	History   []ChatHistoryItem `json:"history,omitempty"` // NEW: Recent messages for context
}

// CrisisResource represents a crisis support resource
type CrisisResource struct {
	Name   string `json:"name"`
	Phone  string `json:"phone,omitempty"`
	URL    string `json:"url,omitempty"`
	Region string `json:"region,omitempty"`
}

// ChatMessageResponse is the response containing the AI reply
type ChatMessageResponse struct {
	Reply        string           `json:"reply"`
	SafetyNotice *string          `json:"safetyNotice,omitempty"`
	CrisisLevel  int              `json:"crisisLevel,omitempty"`  // NEW: 0-3 risk level
	Resources    []CrisisResource `json:"resources,omitempty"`    // NEW: Crisis resources if level >= 2
}
