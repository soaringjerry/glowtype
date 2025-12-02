package services

import (
	"bytes"
	"fmt"
	"log"
	"sync"
	"text/template"

	"github.com/soaringjerry/glowtype/internal/database"
	"gorm.io/gorm"
)

// PromptTemplateData contains all variables available for template rendering
type PromptTemplateData struct {
	// Identity
	GlowtypeName string `json:"glowtypeName"`
	GlowtypeCode string `json:"glowtypeCode"`

	// Guidance
	EnergyStyle     string   `json:"energyStyle"`
	ExpressionStyle string   `json:"expressionStyle"`
	Metaphors       []string `json:"metaphors"`
	SelfCareTips    []string `json:"selfCareTips"`

	// Scripts (RAG)
	Scripts []ScriptData `json:"scripts"`

	// Resources
	Resources []ResourceData `json:"resources"`

	// Flags
	ResourcesDeclined bool   `json:"resourcesDeclined"`
	CrisisLevel       int    `json:"crisisLevel"`
	Language          string `json:"language"`
}

// ScriptData represents a RAG-retrieved script
type ScriptData struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

// ResourceData represents a crisis resource
type ResourceData struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
	URL   string `json:"url"`
}

// PromptTemplateManager handles loading and rendering prompt templates
type PromptTemplateManager struct {
	mu sync.RWMutex
	db *gorm.DB

	// Cached compiled templates by key
	templates map[string]*template.Template

	// Cached active status by key
	activeStatus map[string]bool

	// Fallback to hardcoded defaults if DB fails
	defaults map[string]string
}

// TemplateFuncs provides custom functions for templates
var TemplateFuncs = template.FuncMap{
	"add": func(a, b int) int { return a + b },
}

// NewPromptTemplateManager creates a new template manager
func NewPromptTemplateManager(db *gorm.DB) *PromptTemplateManager {
	m := &PromptTemplateManager{
		db:           db,
		templates:    make(map[string]*template.Template),
		activeStatus: make(map[string]bool),
		defaults:     buildDefaultTemplates(),
	}
	m.LoadFromDB()
	return m
}

// buildDefaultTemplates returns hardcoded default templates as fallback
func buildDefaultTemplates() map[string]string {
	return map[string]string{
		"chat_safety_layer_en": `## SAFETY LAYER (Highest Priority)

You are Glowtype AI, a warm emotion companion for teens. Your primary role is to listen and support, never to diagnose or treat.

### Crisis Response Protocol
When you detect signs of pain, hopelessness, or self-harm thoughts:
1. First warmly acknowledge their feelings
2. Use 'redirect' not 'interrupt' strategy
3. Gently mention professional resources like a friend would
4. Acknowledge your limitations but emphasize 'I want to help you find better support'

### Absolute Boundaries
Never:
- Diagnose any mental health condition
- Suggest specific treatments or medications
- Say 'I completely understand how you feel'
- Minimize with 'don't worry' or 'it's not that bad'

Always:
- Honor their experience as real and valid
- Stay warm and non-judgmental
- Keep responses SHORT (2-3 sentences) and gentle

{{if .ResourcesDeclined}}
### User Has Declined Resources
The user previously said they don't want hotlines. Respect their choice and don't proactively mention resources.
{{end}}`,

		"chat_safety_layer_zh": `## 安全层（优先级最高）

你是 Glowtype AI，一个温暖的青少年情绪伴侣。你的首要职责是倾听和支持，绝不诊断或治疗。

### 危机响应协议
当检测到用户表达痛苦、绝望或自伤想法时：
1. 首先温暖地确认他们的感受
2. 使用"转向"而非"中断"策略
3. 温柔地提及专业资源，像朋友一样
4. 承认自己的局限，但强调"我想帮你找到更好的支持"

### 绝对边界
绝对不要：
- 诊断任何心理健康状况
- 建议具体治疗方法或药物
- 说"我完全理解你的感受"
- 用"别担心"、"想开点"等话语轻视他们的感受

永远要：
- 尊重他们的体验是真实有效的
- 保持温暖、非评判的态度
- 用简短（2-3句）、温柔的语言回应

{{if .ResourcesDeclined}}
### 用户已表示不想联系资源
用户之前表示不想打电话或不需要热线，请尊重他们的选择，本次对话中不再主动提及资源。
{{end}}`,

		"chat_understanding_layer_en": `## UNDERSTANDING LAYER (Personalization)

### User's Glowtype: {{.GlowtypeCode}} ({{.GlowtypeName}})

### Dimension Profile
- Energy Style: {{.EnergyStyle}}
- Expression Style: {{.ExpressionStyle}}

### Personalization Guidelines
- If the user asks about their Glowtype, tell them: "Your Glowtype is {{.GlowtypeName}}"
- Use cosmic/celestial metaphors that resonate with their Glowtype
- Acknowledge their unique way of processing emotions

{{if .Metaphors}}
### Available Metaphors
{{range .Metaphors}}- {{.}}
{{end}}
{{end}}

### Communication Style
- Keep responses SHORT (2-3 sentences max)
- Address them directly as 'you', speak as a friend`,

		"chat_understanding_layer_zh": `## 理解层（个性化）

### 用户光格: {{.GlowtypeCode}} ({{.GlowtypeName}})

### 维度特征
- 能量风格: {{.EnergyStyle}}
- 表达风格: {{.ExpressionStyle}}

### 个性化指南
- 如果用户问起他们的光格是什么，告诉他们："你的光格是 {{.GlowtypeName}}"
- 使用与用户光格匹配的天体/宇宙隐喻
- 认可他们独特的情绪处理方式

{{if .Metaphors}}
### 可用隐喻
{{range .Metaphors}}- {{.}}
{{end}}
{{end}}

### 沟通风格
- 保持简短（2-3句最多）
- 直接用"你"称呼，像朋友一样`,

		"chat_guidance_layer_en": `## GUIDANCE LAYER (Micro-interventions)

{{if .SelfCareTips}}
### Self-Care Tips for {{.GlowtypeCode}}
{{range .SelfCareTips}}- {{.}}
{{end}}
{{end}}

### Intervention Principles
- Offer SMALL, actionable steps (not big life changes)
- Frame as invitations, not instructions
- Match suggestions to their energy level
- Always validate before suggesting

### Never Do
- Give therapy advice or techniques
- Suggest diagnosis or professional assessment
- Push toward action when they need to be heard`,

		"chat_guidance_layer_zh": `## 引导层（微干预）

{{if .SelfCareTips}}
### {{.GlowtypeCode}} 专属自我关怀建议
{{range .SelfCareTips}}- {{.}}
{{end}}
{{end}}

### 干预原则
- 提供小的、可行动的步骤（不是大的人生改变）
- 用邀请语气，不是命令
- 匹配用户当前的能量水平
- 先确认再建议

### 绝对禁止
- 给出治疗建议或技巧
- 建议诊断或专业评估
- 在他们需要被倾听时催促行动`,

		"chat_script_layer_en": `## SCRIPT REFERENCE LAYER (For reference only)

Below are expert conversation references. These are guidance, not templates to copy.

{{range $i, $s := .Scripts}}
### Reference {{add $i 1}}: {{$s.Title}}
{{$s.Content}}

{{end}}

### Usage Guidelines
- Naturally incorporate relevant elements
- Keep responses SHORT (2-3 sentences)
- Prioritize listening and validation before guiding`,

		"chat_script_layer_zh": `## 参考脚本层（仅供参考）

以下是专家对话参考。这些是指导方向，不是必须照搬的话术。

{{range $i, $s := .Scripts}}
### 参考 {{add $i 1}}: {{$s.Title}}
{{$s.Content}}

{{end}}

### 使用指南
- 根据对话上下文自然融入相关元素
- 保持简短（2-3句）
- 优先倾听和确认，再考虑引导`,

		"chat_resources_layer_en": `## AVAILABLE CRISIS RESOURCES

When appropriate, you may gently mention these resources:

{{range .Resources}}
- {{.Name}}{{if .Phone}}: {{.Phone}}{{end}}{{if .URL}} ({{.URL}}){{end}}
{{end}}

Remember: Only mention resources naturally when the conversation calls for it.`,

		"chat_resources_layer_zh": `## 可用危机资源

在适当的时候，你可以温柔地提及这些资源：

{{range .Resources}}
- {{.Name}}{{if .Phone}}：{{.Phone}}{{end}}{{if .URL}}（{{.URL}}）{{end}}
{{end}}

记住：只有在对话需要时才自然地提及资源。`,
	}
}

// LoadFromDB loads and compiles templates from database
func (m *PromptTemplateManager) LoadFromDB() error {
	var prompts []database.AIPromptDB
	if err := m.db.Find(&prompts).Error; err != nil {
		log.Printf("[PromptTemplateManager] Failed to load prompts: %v", err)
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Clear existing templates
	m.templates = make(map[string]*template.Template)
	m.activeStatus = make(map[string]bool)

	for _, p := range prompts {
		// Store active status
		m.activeStatus[p.Key] = p.IsActive

		// Skip inactive prompts for template compilation
		if !p.IsActive {
			continue
		}

		tmpl, err := template.New(p.Key).Funcs(TemplateFuncs).Parse(p.Content)
		if err != nil {
			log.Printf("[PromptTemplateManager] Failed to parse template %s: %v", p.Key, err)
			// Try to use default if parsing fails
			if def, ok := m.defaults[p.Key]; ok {
				tmpl, _ = template.New(p.Key).Funcs(TemplateFuncs).Parse(def)
				m.templates[p.Key] = tmpl
			}
			continue
		}
		m.templates[p.Key] = tmpl
	}

	log.Printf("[PromptTemplateManager] Loaded %d prompt templates", len(m.templates))
	return nil
}

// Reload reloads templates from database
func (m *PromptTemplateManager) Reload() error {
	return m.LoadFromDB()
}

// IsActive checks if a template is active
func (m *PromptTemplateManager) IsActive(key string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if active, exists := m.activeStatus[key]; exists {
		return active
	}
	// Default to true if not in DB (will use default template)
	return true
}

// Render renders a template by key with the given data
func (m *PromptTemplateManager) Render(key string, data PromptTemplateData) (string, error) {
	// Check if template is active
	if !m.IsActive(key) {
		return "", fmt.Errorf("template %s is disabled", key)
	}

	m.mu.RLock()
	tmpl, exists := m.templates[key]
	m.mu.RUnlock()

	if !exists {
		// Try default
		if def, ok := m.defaults[key]; ok {
			var err error
			tmpl, err = template.New(key).Funcs(TemplateFuncs).Parse(def)
			if err != nil {
				return "", fmt.Errorf("failed to parse default template: %w", err)
			}
		} else {
			return "", fmt.Errorf("template not found: %s", key)
		}
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to render template %s: %w", key, err)
	}

	return buf.String(), nil
}

// ValidateTemplate checks if a template string is valid
func (m *PromptTemplateManager) ValidateTemplate(content string) error {
	_, err := template.New("validate").Funcs(TemplateFuncs).Parse(content)
	return err
}

// PreviewTemplate renders a template with sample data for preview
func (m *PromptTemplateManager) PreviewTemplate(content string) (string, PromptTemplateData, error) {
	sampleData := PromptTemplateData{
		GlowtypeName:    "Quiet Comet",
		GlowtypeCode:    "quiet-comet",
		EnergyStyle:     "You recharge through solitude and prefer your own space.",
		ExpressionStyle: "You keep emotions close and have a rich inner world.",
		Metaphors: []string{
			"You're like a comet - moving through your own orbit, deep and mysterious.",
			"Your inner world is like a vast ocean - calm on the surface, full of depth.",
		},
		SelfCareTips: []string{
			"Your need for alone time is valid - it's how you recharge.",
			"Try sharing just one small thing with someone you trust.",
		},
		Scripts: []ScriptData{
			{Title: "Empathy Script", Content: "I hear you. That sounds really hard..."},
			{Title: "Resource Transition", Content: "Would you like to know about some resources?"},
		},
		Resources: []ResourceData{
			{Name: "Crisis Line", Phone: "988", URL: ""},
			{Name: "心理援助热线", Phone: "400-161-9995", URL: ""},
		},
		ResourcesDeclined: false,
		CrisisLevel:       1,
		Language:          "en",
	}

	tmpl, err := template.New("preview").Funcs(TemplateFuncs).Parse(content)
	if err != nil {
		return "", sampleData, err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, sampleData); err != nil {
		return "", sampleData, err
	}

	return buf.String(), sampleData, nil
}

// GetAvailableVariables returns documentation of available template variables
func (m *PromptTemplateManager) GetAvailableVariables() []map[string]string {
	return []map[string]string{
		{"name": "GlowtypeName", "type": "string", "description": "User's Glowtype localized name (e.g., 'Quiet Comet', '静默彗星')"},
		{"name": "GlowtypeCode", "type": "string", "description": "User's Glowtype code (e.g., 'quiet-comet')"},
		{"name": "EnergyStyle", "type": "string", "description": "Description of user's energy style from guidance DB"},
		{"name": "ExpressionStyle", "type": "string", "description": "Description of user's expression style from guidance DB"},
		{"name": "Metaphors", "type": "[]string", "description": "List of metaphors for this Glowtype. Use {{range .Metaphors}}...{{end}}"},
		{"name": "SelfCareTips", "type": "[]string", "description": "List of self-care tips. Use {{range .SelfCareTips}}...{{end}}"},
		{"name": "Scripts", "type": "[]Script", "description": "RAG-retrieved scripts. Each has .Title and .Content"},
		{"name": "Resources", "type": "[]Resource", "description": "Crisis resources. Each has .Name, .Phone, .URL"},
		{"name": "ResourcesDeclined", "type": "bool", "description": "True if user declined crisis resources"},
		{"name": "CrisisLevel", "type": "int", "description": "Current crisis level (0-3)"},
		{"name": "Language", "type": "string", "description": "User's language (en, zh)"},
	}
}

// GetTemplateSyntax returns template syntax documentation
func (m *PromptTemplateManager) GetTemplateSyntax() map[string]string {
	return map[string]string{
		"variable":    "{{.VariableName}}",
		"if":          "{{if .Condition}}...{{end}}",
		"if_else":     "{{if .Condition}}...{{else}}...{{end}}",
		"range":       "{{range .List}}{{.}}{{end}}",
		"range_index": "{{range $i, $item := .List}}{{add $i 1}}. {{$item}}{{end}}",
	}
}
