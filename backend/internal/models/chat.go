package models

type ChatSessionRequest struct {
	Language   string `json:"language"`
	GlowtypeID string `json:"glowtypeId"`
}

type ChatSessionResponse struct {
	SessionID string `json:"sessionId"`
}

type ChatMessageRequest struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
	Language  string `json:"language"`
}

type ChatMessageResponse struct {
	Reply        string  `json:"reply"`
	SafetyNotice *string `json:"safetyNotice"`
}

