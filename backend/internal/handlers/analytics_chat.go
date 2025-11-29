package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/soaringjerry/glowtype/internal/services"
)

// AnalyticsChatHandler handles AI chat for analytics interpretation
type AnalyticsChatHandler struct {
	chatService *services.ChatService
}

// NewAnalyticsChatHandler creates a new analytics chat handler
func NewAnalyticsChatHandler(chatService *services.ChatService) *AnalyticsChatHandler {
	return &AnalyticsChatHandler{
		chatService: chatService,
	}
}

// ChatMessage represents a message in the conversation
type ChatMessage struct {
	Role    string `json:"role"`    // "user" or "assistant"
	Content string `json:"content"`
}

// AnalyticsChatRequest is the request for analytics chat
type AnalyticsChatRequest struct {
	Messages []ChatMessage `json:"messages"`
	Context  struct {
		CurrentView   string          `json:"currentView"`   // e.g., "reliability", "dimensions"
		AnalyticsData json.RawMessage `json:"analyticsData"` // The analytics data for RAG
		Language      string          `json:"language"`
	} `json:"context"`
}

// AnalyticsChatResponse is the response from analytics chat
type AnalyticsChatResponse struct {
	ID          string       `json:"id"`
	Content     string       `json:"content"`
	Suggestions []Suggestion `json:"suggestions,omitempty"`
}

// Suggestion is an actionable suggestion from AI
type Suggestion struct {
	Type   string `json:"type"`   // "action", "link"
	Label  string `json:"label"`
	Action string `json:"action"` // e.g., "scrollTo:itemCorrelations"
}

// Chat handles the analytics chat endpoint
// POST /api/admin/analytics/chat
func (h *AnalyticsChatHandler) Chat(c *gin.Context) {
	// Rate limiting
	if !h.chatService.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many requests"})
		return
	}

	var req AnalyticsChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "messages cannot be empty"})
		return
	}

	// Get the last user message
	lastMessage := req.Messages[len(req.Messages)-1]
	if lastMessage.Role != "user" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "last message must be from user"})
		return
	}

	// Build system prompt with analytics data context
	systemPrompt := h.buildSystemPrompt(req.Context.AnalyticsData, req.Context.CurrentView, req.Context.Language)

	// Build conversation context for multi-turn
	userPrompt := h.buildConversationContext(req.Messages)

	// Generate response
	reply := h.chatService.GenerateInsight(systemPrompt, userPrompt, req.Context.Language)

	// Parse for suggestions (simple pattern matching)
	suggestions := h.extractSuggestions(reply, req.Context.Language)

	c.JSON(http.StatusOK, AnalyticsChatResponse{
		ID:          fmt.Sprintf("chat_%d", len(req.Messages)),
		Content:     reply,
		Suggestions: suggestions,
	})
}

// buildSystemPrompt creates the system prompt with analytics data
func (h *AnalyticsChatHandler) buildSystemPrompt(analyticsData json.RawMessage, currentView, language string) string {
	isZh := strings.HasPrefix(language, "zh")

	var basePrompt string
	if isZh {
		basePrompt = `你是一个专业的心理测评数据分析助手，帮助用户理解他们的量表统计分析结果。

你的职责：
1. 用通俗易懂的语言解释统计指标的含义
2. 基于数据给出具体的、可操作的建议
3. 指出数据中的潜在问题和改进方向
4. 回答用户关于数据分析的任何问题

统计术语解释指南：
- Cronbach's Alpha: 内部一致性信度，反映量表的可靠程度。>0.9优秀，>0.8良好，>0.7可接受，<0.6需要改进
- 分半信度: 将题目分成两半计算相关，反映量表的稳定性
- Spearman-Brown: 分半信度的校正系数，考虑了只用一半题目的影响
- 题目-总分相关: 单个题目与量表总分的相关程度，<0.3的题目可能需要修改或删除
- 偏度(Skewness): 分布的不对称程度，0表示对称，正值右偏，负值左偏
- 峰度(Kurtosis): 分布的尖峭程度，0表示正态，正值尖峭，负值平坦
- Cohen's d: 效应量，表示组间差异的实际意义，<0.2很小，0.2-0.5小，0.5-0.8中等，>0.8大

回答时请：
- 使用简单的语言，避免过于专业的术语
- 给出具体的数值引用，而不是泛泛而谈
- 如果有问题需要改进，给出明确的建议
- 适当使用emoji让回答更友好
- 如果涉及需要改进的题目，建议用户查看"题目-总分相关"部分`
	} else {
		basePrompt = `You are a professional psychometric data analysis assistant, helping users understand their scale statistical analysis results.

Your responsibilities:
1. Explain statistical indicators in plain language
2. Provide specific, actionable suggestions based on the data
3. Point out potential issues and improvement directions
4. Answer any questions about data analysis

Statistical terminology guide:
- Cronbach's Alpha: Internal consistency reliability, reflects scale reliability. >0.9 excellent, >0.8 good, >0.7 acceptable, <0.6 needs improvement
- Split-half reliability: Correlation between two halves of items, reflects scale stability
- Spearman-Brown: Correction coefficient for split-half reliability
- Item-total correlation: Correlation between individual items and total score, items <0.3 may need revision
- Skewness: Distribution asymmetry, 0=symmetric, positive=right-skewed, negative=left-skewed
- Kurtosis: Distribution peakedness, 0=normal, positive=peaked, negative=flat
- Cohen's d: Effect size, <0.2 negligible, 0.2-0.5 small, 0.5-0.8 medium, >0.8 large

When responding:
- Use simple language, avoid overly technical jargon
- Reference specific numbers rather than speaking generically
- Give clear suggestions if improvements are needed
- Use emojis appropriately to make responses friendly
- If items need improvement, suggest checking "Item-Total Correlations"`
	}

	// Add current view context
	viewContext := ""
	if isZh {
		switch currentView {
		case "reliability":
			viewContext = "\n\n用户当前正在查看【信度分析】面板。"
		case "dimensions":
			viewContext = "\n\n用户当前正在查看【维度统计】面板。"
		case "trends":
			viewContext = "\n\n用户当前正在查看【趋势分析】面板。"
		case "segments":
			viewContext = "\n\n用户当前正在查看【群组分析】面板。"
		case "correlations":
			viewContext = "\n\n用户当前正在查看【相关矩阵】面板。"
		}
	} else {
		switch currentView {
		case "reliability":
			viewContext = "\n\nThe user is currently viewing the [Reliability Analysis] panel."
		case "dimensions":
			viewContext = "\n\nThe user is currently viewing the [Dimension Statistics] panel."
		case "trends":
			viewContext = "\n\nThe user is currently viewing the [Trend Analysis] panel."
		case "segments":
			viewContext = "\n\nThe user is currently viewing the [Segment Analysis] panel."
		case "correlations":
			viewContext = "\n\nThe user is currently viewing the [Correlation Matrix] panel."
		}
	}

	// Add analytics data context
	dataContext := ""
	if len(analyticsData) > 0 {
		if isZh {
			dataContext = fmt.Sprintf("\n\n当前分析数据：\n```json\n%s\n```", string(analyticsData))
		} else {
			dataContext = fmt.Sprintf("\n\nCurrent analytics data:\n```json\n%s\n```", string(analyticsData))
		}
	}

	return basePrompt + viewContext + dataContext
}

// buildConversationContext builds the conversation history for multi-turn
func (h *AnalyticsChatHandler) buildConversationContext(messages []ChatMessage) string {
	if len(messages) == 1 {
		return messages[0].Content
	}

	// Build conversation context
	var sb strings.Builder
	sb.WriteString("Conversation history:\n")
	for i, msg := range messages[:len(messages)-1] {
		role := "User"
		if msg.Role == "assistant" {
			role = "Assistant"
		}
		sb.WriteString(fmt.Sprintf("%d. %s: %s\n", i+1, role, msg.Content))
	}
	sb.WriteString(fmt.Sprintf("\nCurrent question: %s", messages[len(messages)-1].Content))
	return sb.String()
}

// extractSuggestions extracts actionable suggestions from the AI response
func (h *AnalyticsChatHandler) extractSuggestions(reply, language string) []Suggestion {
	suggestions := []Suggestion{}
	isZh := strings.HasPrefix(language, "zh")

	// Check for item improvement suggestions
	if strings.Contains(reply, "题目-总分相关") || strings.Contains(reply, "Item-Total") ||
		strings.Contains(reply, "需要修改") || strings.Contains(reply, "need revision") {
		label := "View Item Correlations"
		if isZh {
			label = "查看题目相关性"
		}
		suggestions = append(suggestions, Suggestion{
			Type:   "action",
			Label:  label,
			Action: "scrollTo:itemCorrelations",
		})
	}

	// Check for reliability interpretation
	if strings.Contains(reply, "Cronbach") || strings.Contains(reply, "信度") {
		if strings.Contains(reply, "改进") || strings.Contains(reply, "improve") ||
			strings.Contains(reply, "较低") || strings.Contains(reply, "low") {
			label := "View Reliability Details"
			if isZh {
				label = "查看信度详情"
			}
			suggestions = append(suggestions, Suggestion{
				Type:   "action",
				Label:  label,
				Action: "scrollTo:reliability",
			})
		}
	}

	// Limit to 3 suggestions
	if len(suggestions) > 3 {
		suggestions = suggestions[:3]
	}

	return suggestions
}

// QuickQuestion handles predefined quick questions
type QuickQuestionRequest struct {
	QuestionType  string          `json:"questionType"` // "reliability", "dimension", "trend", etc.
	AnalyticsData json.RawMessage `json:"analyticsData"`
	Language      string          `json:"language"`
}

// QuickQuestion generates a response for predefined question types
// POST /api/admin/analytics/quick-question
func (h *AnalyticsChatHandler) QuickQuestion(c *gin.Context) {
	if !h.chatService.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many requests"})
		return
	}

	var req QuickQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	isZh := strings.HasPrefix(req.Language, "zh")

	// Map question type to actual question
	var question string
	switch req.QuestionType {
	case "reliability":
		if isZh {
			question = "请分析当前的信度指标（Cronbach's Alpha和分半信度），判断是否达到可接受水平，以及有哪些需要改进的地方？"
		} else {
			question = "Please analyze the current reliability metrics (Cronbach's Alpha and split-half reliability). Are they at acceptable levels? What improvements are needed?"
		}
	case "dimension":
		if isZh {
			question = "请分析各个维度的统计分布特征，有哪些维度的数据分布异常？"
		} else {
			question = "Please analyze the statistical distribution of each dimension. Are there any dimensions with abnormal distributions?"
		}
	case "correlation":
		if isZh {
			question = "请解读维度之间的相关性矩阵，这些相关性意味着什么？有没有问题需要关注？"
		} else {
			question = "Please interpret the correlation matrix between dimensions. What do these correlations mean? Are there any concerns?"
		}
	case "trend":
		if isZh {
			question = "请分析最近的数据趋势，有什么值得关注的变化吗？"
		} else {
			question = "Please analyze recent data trends. Are there any noteworthy changes?"
		}
	case "improvement":
		if isZh {
			question = "基于当前数据，请给出具体的量表改进建议，包括哪些题目可能需要修改。"
		} else {
			question = "Based on the current data, please provide specific scale improvement suggestions, including which items may need revision."
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown question type"})
		return
	}

	// Build system prompt
	systemPrompt := h.buildSystemPrompt(req.AnalyticsData, req.QuestionType, req.Language)

	// Generate response
	reply := h.chatService.GenerateInsight(systemPrompt, question, req.Language)
	suggestions := h.extractSuggestions(reply, req.Language)

	c.JSON(http.StatusOK, AnalyticsChatResponse{
		ID:          "quick_" + req.QuestionType,
		Content:     reply,
		Suggestions: suggestions,
	})
}
