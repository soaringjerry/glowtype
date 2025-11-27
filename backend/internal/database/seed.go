package database

import (
	"encoding/json"
	"log"

	"gorm.io/gorm"
)

// SeedDatabase populates the database with example data if tables are empty
// Set SEED_DB_FORCE=true to force re-seed even if data exists
func SeedDatabase(db *gorm.DB, force bool) {
	// Check if already seeded
	var count int64
	db.Model(&TraitDimensionDB{}).Count(&count)
	if count > 0 && !force {
		log.Println("Database already has data, skipping seed (set SEED_DB_FORCE=true to override)")
		return
	}

	if force && count > 0 {
		log.Println("SEED_DB_FORCE=true, clearing existing data...")
		db.Exec("DELETE FROM scoring_rules")
		db.Exec("DELETE FROM glowtype_i18n")
		db.Exec("DELETE FROM glowtypes")
		db.Exec("DELETE FROM quiz_questions")
		db.Exec("DELETE FROM trait_dimensions")
		db.Exec("DELETE FROM ai_prompts")
	}

	log.Println("Seeding database with example data...")
	seedDimensions(db)
	seedQuestions(db)
	seedGlowtypes(db)
	seedRules(db)
	seedPrompts(db)
	log.Println("Database seed complete!")
}

func seedDimensions(db *gorm.DB) {
	dimensions := []TraitDimensionDB{
		{
			Key:             "energy",
			NameZH:          "能量来源",
			NameEN:          "Energy Source",
			PositivePole:    "外向",
			NegativePole:    "内向",
			Description:     "衡量你从社交还是独处中获取能量",
			StrongThreshold: 3,
			MildThreshold:   1,
			DisplayOrder:    1,
		},
		{
			Key:             "expression",
			NameZH:          "情绪表达",
			NameEN:          "Emotional Expression",
			PositivePole:    "外放",
			NegativePole:    "内敛",
			Description:     "衡量你表达情绪的方式",
			StrongThreshold: 3,
			MildThreshold:   1,
			DisplayOrder:    2,
		},
	}

	for _, d := range dimensions {
		if err := db.Create(&d).Error; err != nil {
			log.Printf("  Failed to create dimension '%s': %v", d.Key, err)
		}
	}
}

func seedQuestions(db *gorm.DB) {
	questions := []struct {
		QuestionID string
		Order      int
		QuestionZH string
		QuestionEN string
		Options    []OptionConfig
	}{
		{
			QuestionID: "q1",
			Order:      1,
			QuestionZH: "当你感到压力很大时，你通常会先做什么？",
			QuestionEN: "When you feel stressed, what do you usually do first?",
			Options: []OptionConfig{
				{Text: map[string]string{"zh": "找好朋友聊一聊", "en": "Talk to a close friend"}, Value: "extrovert_express", Scores: map[string]float64{"energy": 1, "expression": 1}},
				{Text: map[string]string{"zh": "自己扛，不跟人说", "en": "Keep it to yourself"}, Value: "introvert_suppress", Scores: map[string]float64{"energy": -1, "expression": -1}},
				{Text: map[string]string{"zh": "在社交媒体上发泄", "en": "Vent on social media"}, Value: "introvert_express", Scores: map[string]float64{"energy": -1, "expression": 1}},
				{Text: map[string]string{"zh": "约朋友出去放松但不聊压力", "en": "Hang out with friends but avoid the topic"}, Value: "extrovert_suppress", Scores: map[string]float64{"energy": 1, "expression": -1}},
			},
		},
		{
			QuestionID: "q2",
			Order:      2,
			QuestionZH: "周末最理想的充电方式是？",
			QuestionEN: "What's your ideal way to recharge on weekends?",
			Options: []OptionConfig{
				{Text: map[string]string{"zh": "参加聚会或社交活动", "en": "Attend parties or social events"}, Value: "extrovert", Scores: map[string]float64{"energy": 2}},
				{Text: map[string]string{"zh": "在家追剧或打游戏", "en": "Stay home watching shows or gaming"}, Value: "introvert", Scores: map[string]float64{"energy": -2}},
				{Text: map[string]string{"zh": "和一两个好友深聊", "en": "Deep conversations with 1-2 close friends"}, Value: "mild_extrovert", Scores: map[string]float64{"energy": 1}},
				{Text: map[string]string{"zh": "独自去咖啡馆或书店", "en": "Solo trip to a cafe or bookstore"}, Value: "mild_introvert", Scores: map[string]float64{"energy": -1}},
			},
		},
		{
			QuestionID: "q3",
			Order:      3,
			QuestionZH: "当你很难过的时候，你更倾向于？",
			QuestionEN: "When you're really sad, do you tend to?",
			Options: []OptionConfig{
				{Text: map[string]string{"zh": "哭出来，让情绪流出", "en": "Cry it out, let emotions flow"}, Value: "express", Scores: map[string]float64{"expression": 2}},
				{Text: map[string]string{"zh": "压在心里，不想让人看到", "en": "Keep it inside, don't want others to see"}, Value: "suppress", Scores: map[string]float64{"expression": -2}},
				{Text: map[string]string{"zh": "写日记或创作来表达", "en": "Write in a journal or create to express"}, Value: "creative_express", Scores: map[string]float64{"expression": 1}},
				{Text: map[string]string{"zh": "假装没事，转移注意力", "en": "Pretend you're fine, distract yourself"}, Value: "mild_suppress", Scores: map[string]float64{"expression": -1}},
			},
		},
		{
			QuestionID: "q4",
			Order:      4,
			QuestionZH: "在团队合作中，你通常扮演什么角色？",
			QuestionEN: "In team projects, what role do you usually play?",
			Options: []OptionConfig{
				{Text: map[string]string{"zh": "主动发言和协调", "en": "Actively speak up and coordinate"}, Value: "leader", Scores: map[string]float64{"energy": 1, "expression": 1}},
				{Text: map[string]string{"zh": "默默完成自己的部分", "en": "Quietly complete your own part"}, Value: "executor", Scores: map[string]float64{"energy": -1, "expression": -1}},
				{Text: map[string]string{"zh": "提供创意但让别人发言", "en": "Provide ideas but let others speak"}, Value: "thinker", Scores: map[string]float64{"energy": -1, "expression": 1}},
				{Text: map[string]string{"zh": "组织活动但不表达太多意见", "en": "Organize things but don't voice opinions much"}, Value: "organizer", Scores: map[string]float64{"energy": 1, "expression": -1}},
			},
		},
		{
			QuestionID: "q5",
			Order:      5,
			QuestionZH: "你内心的状态更像是？",
			QuestionEN: "Your inner state is more like?",
			Options: []OptionConfig{
				{Text: map[string]string{"zh": "热闹的市集，想法很多也爱分享", "en": "A busy market, lots of thoughts and love to share"}, Value: "radiant", Scores: map[string]float64{"energy": 1, "expression": 1}},
				{Text: map[string]string{"zh": "静谧的湖面，平静但深沉", "en": "A quiet lake, calm but deep"}, Value: "quiet", Scores: map[string]float64{"energy": -1, "expression": -1}},
				{Text: map[string]string{"zh": "独自绽放的烟火，有想法但不常说", "en": "Fireworks alone, have thoughts but rarely share"}, Value: "hidden", Scores: map[string]float64{"energy": -1, "expression": 1}},
				{Text: map[string]string{"zh": "温暖的篝火，喜欢陪伴但不爱表达", "en": "A warm bonfire, enjoy company but don't express much"}, Value: "warm", Scores: map[string]float64{"energy": 1, "expression": -1}},
			},
		},
	}

	for _, q := range questions {
		optionsJSON, _ := json.Marshal(q.Options)
		question := QuizQuestionDB{
			QuestionID: q.QuestionID,
			Order:      q.Order,
			QuestionZH: q.QuestionZH,
			QuestionEN: q.QuestionEN,
			Options:    optionsJSON,
			IsActive:   true,
		}
		if err := db.Create(&question).Error; err != nil {
			log.Printf("  Failed to create question '%s': %v", q.QuestionID, err)
		}
	}
}

func seedGlowtypes(db *gorm.DB) {
	glowtypes := []struct {
		TypeCode     string
		AuraGradient string
		CardAccent   string
		TextColor    string
		PrimaryColor string
		IconName     string
		I18N         []struct {
			Lang         string
			Name         string
			Tagline      string
			Description  string
			SelfCareTips string
			Disclaimer   string
		}
	}{
		{
			TypeCode:     "radiant-nebula",
			AuraGradient: "linear-gradient(135deg, #FF6B6B 0%, #FFE66D 50%, #4ECDC4 100%)",
			CardAccent:   "#FF6B6B",
			TextColor:    "#2C3E50",
			PrimaryColor: "#FF6B6B",
			IconName:     "sun",
			I18N: []struct {
				Lang         string
				Name         string
				Tagline      string
				Description  string
				SelfCareTips string
				Disclaimer   string
			}{
				{Lang: "zh", Name: "璀璨星云", Tagline: "热情洋溢，光芒四射", Description: "你是人群中的小太阳，喜欢社交也善于表达。你的能量来自于与人互动，也乐于分享自己的想法和感受。", SelfCareTips: "记得给自己留一点独处时间，热情也需要充电。", Disclaimer: "这只是一个轻量的性格小测试，并不是心理诊断。"},
				{Lang: "en", Name: "Radiant Nebula", Tagline: "Enthusiastic and radiant", Description: "You're the sunshine in any group, loving social interaction and self-expression. Your energy comes from connecting with others, and you enjoy sharing your thoughts and feelings.", SelfCareTips: "Remember to save some alone time for yourself - even enthusiasm needs recharging.", Disclaimer: "This is a light personality quiz, not a psychological diagnosis."},
			},
		},
		{
			TypeCode:     "quiet-comet",
			AuraGradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
			CardAccent:   "#667eea",
			TextColor:    "#2C3E50",
			PrimaryColor: "#667eea",
			IconName:     "moon",
			I18N: []struct {
				Lang         string
				Name         string
				Tagline      string
				Description  string
				SelfCareTips string
				Disclaimer   string
			}{
				{Lang: "zh", Name: "静默彗星", Tagline: "外表平静，内心深邃", Description: "你更喜欢独处，也习惯把情绪放在心里。你有丰富的内心世界，但不太愿意轻易展示给别人。", SelfCareTips: "可以尝试只分享一件小事给你信任的人，不需要一次说完所有。", Disclaimer: "这只是一个轻量的性格小测试，并不是心理诊断。"},
				{Lang: "en", Name: "Quiet Comet", Tagline: "Calm outside, deep inside", Description: "You prefer solitude and tend to keep emotions to yourself. You have a rich inner world but don't easily reveal it to others.", SelfCareTips: "Try sharing just one small thing with someone you trust - you don't need to share everything at once.", Disclaimer: "This is a light personality quiz, not a psychological diagnosis."},
			},
		},
		{
			TypeCode:     "hidden-aurora",
			AuraGradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
			CardAccent:   "#a8edea",
			TextColor:    "#2C3E50",
			PrimaryColor: "#a8edea",
			IconName:     "sparkles",
			I18N: []struct {
				Lang         string
				Name         string
				Tagline      string
				Description  string
				SelfCareTips string
				Disclaimer   string
			}{
				{Lang: "zh", Name: "隐秘极光", Tagline: "独自绽放，内心绚烂", Description: "你喜欢独处，但内心有很多想要表达的东西。你可能更擅长通过文字、艺术等方式来展现自己。", SelfCareTips: "找到适合你的表达方式，不一定要面对面，写作或创作也是很好的出口。", Disclaimer: "这只是一个轻量的性格小测试，并不是心理诊断。"},
				{Lang: "en", Name: "Hidden Aurora", Tagline: "Blooming alone, vibrant inside", Description: "You enjoy solitude but have much to express. You might be better at showing yourself through writing, art, or other creative outlets.", SelfCareTips: "Find your own way to express - it doesn't have to be face-to-face. Writing or creating can be great outlets.", Disclaimer: "This is a light personality quiz, not a psychological diagnosis."},
			},
		},
		{
			TypeCode:     "warm-ember",
			AuraGradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
			CardAccent:   "#f5576c",
			TextColor:    "#2C3E50",
			PrimaryColor: "#f5576c",
			IconName:     "flame",
			I18N: []struct {
				Lang         string
				Name         string
				Tagline      string
				Description  string
				SelfCareTips string
				Disclaimer   string
			}{
				{Lang: "zh", Name: "温暖余烬", Tagline: "喜欢陪伴，不善言辞", Description: "你享受与人相处的感觉，但不太习惯表达自己的情绪。你更喜欢用行动而不是语言来关心别人。", SelfCareTips: "试着用简单的话告诉身边的人你的感受，他们会很高兴知道你在想什么。", Disclaimer: "这只是一个轻量的性格小测试，并不是心理诊断。"},
				{Lang: "en", Name: "Warm Ember", Tagline: "Loves company, few words", Description: "You enjoy being around others but aren't used to expressing your emotions. You prefer showing care through actions rather than words.", SelfCareTips: "Try telling people around you how you feel in simple words - they'll be happy to know what you're thinking.", Disclaimer: "This is a light personality quiz, not a psychological diagnosis."},
			},
		},
	}

	for _, gt := range glowtypes {
		glowtype := GlowtypeDB{
			TypeCode:     gt.TypeCode,
			AuraGradient: gt.AuraGradient,
			CardAccent:   gt.CardAccent,
			TextColor:    gt.TextColor,
			PrimaryColor: gt.PrimaryColor,
			IconName:     gt.IconName,
			IsActive:     true,
		}
		if err := db.Create(&glowtype).Error; err != nil {
			log.Printf("  Failed to create glowtype '%s': %v", gt.TypeCode, err)
			continue
		}
		for _, i18n := range gt.I18N {
			i18nRecord := GlowtypeI18NDB{
				GlowtypeID:   glowtype.ID,
				Lang:         i18n.Lang,
				Name:         i18n.Name,
				Tagline:      i18n.Tagline,
				Description:  i18n.Description,
				SelfCareTips: i18n.SelfCareTips,
				Disclaimer:   i18n.Disclaimer,
			}
			db.Create(&i18nRecord)
		}
	}
}

func seedRules(db *gorm.DB) {
	rules := []struct {
		Name           string
		Description    string
		ResultTypeCode string
		Priority       int
		IsFallback     bool
		Conditions     RuleConditions
	}{
		{
			Name:           "Radiant Nebula Rule",
			Description:    "外向且善于表达：energy >= 0 AND expression >= 0",
			ResultTypeCode: "radiant-nebula",
			Priority:       10,
			Conditions: RuleConditions{
				Dimensions: map[string]DimensionCondition{
					"energy":     {Min: floatPtr(0)},
					"expression": {Min: floatPtr(0)},
				},
			},
		},
		{
			Name:           "Quiet Comet Rule",
			Description:    "内向且内敛：energy < 0 AND expression < 0",
			ResultTypeCode: "quiet-comet",
			Priority:       10,
			Conditions: RuleConditions{
				Dimensions: map[string]DimensionCondition{
					"energy":     {Max: floatPtr(-0.01)},
					"expression": {Max: floatPtr(-0.01)},
				},
			},
		},
		{
			Name:           "Hidden Aurora Rule",
			Description:    "内向但善于表达：energy < 0 AND expression >= 0",
			ResultTypeCode: "hidden-aurora",
			Priority:       10,
			Conditions: RuleConditions{
				Dimensions: map[string]DimensionCondition{
					"energy":     {Max: floatPtr(-0.01)},
					"expression": {Min: floatPtr(0)},
				},
			},
		},
		{
			Name:           "Warm Ember Rule",
			Description:    "外向但内敛：energy >= 0 AND expression < 0",
			ResultTypeCode: "warm-ember",
			Priority:       10,
			Conditions: RuleConditions{
				Dimensions: map[string]DimensionCondition{
					"energy":     {Min: floatPtr(0)},
					"expression": {Max: floatPtr(-0.01)},
				},
			},
		},
		{
			Name:           "Fallback Rule",
			Description:    "默认匹配 - 当其他规则都不匹配时",
			ResultTypeCode: "quiet-comet",
			Priority:       0,
			IsFallback:     true,
			Conditions:     RuleConditions{Dimensions: map[string]DimensionCondition{}},
		},
	}

	for _, r := range rules {
		conditionsJSON, _ := json.Marshal(r.Conditions)
		rule := ScoringRuleDB{
			Name:           r.Name,
			Description:    r.Description,
			Conditions:     conditionsJSON,
			ResultTypeCode: r.ResultTypeCode,
			Priority:       r.Priority,
			IsFallback:     r.IsFallback,
			IsActive:       true,
		}
		if err := db.Create(&rule).Error; err != nil {
			log.Printf("  Failed to create rule '%s': %v", r.Name, err)
		}
	}
}

func floatPtr(v float64) *float64 {
	return &v
}

// DefaultPrompts defines all required AI prompt slots with their default content
var DefaultPrompts = []AIPromptDB{
	{
		Key:         "cosmic_insight_system_en",
		Name:        "Cosmic Insight (English)",
		Description: "System prompt for generating poetic cosmic insights about the user's Glowtype. Used on the result page when user clicks 'Get Cosmic Insight'.",
		Content: `You are a poetic, mystical guide who speaks in short, evocative phrases.
Your role is to give a brief cosmic insight about someone's emotional archetype.
IMPORTANT: Keep your response to 1-2 sentences MAX (under 30 words). Be poetic but concise.
Speak directly to the person using "you".`,
		IsActive: true,
	},
	{
		Key:         "cosmic_insight_system_zh",
		Name:        "宇宙洞察（中文）",
		Description: "用于生成关于用户 Glowtype 的诗意宇宙洞察的系统提示词。在结果页点击「获取宇宙洞察」时使用。",
		Content: `你是一位诗意的神秘向导，用简短而富有诗意的语言表达。
你的任务是给出关于某人情绪原型的简短宇宙洞察。
重要：回复必须控制在1-2句话以内（不超过30个字）。要有诗意但简洁。
直接用"你"称呼对方。`,
		IsActive: true,
	},
	{
		Key:         "chat_system_en",
		Name:        "AI Chat (English)",
		Description: "System prompt for the AI chat companion. Defines the AI's personality and response guidelines for English conversations.",
		Content: `You are Glowtype AI, a warm and supportive companion. You listen with empathy and respond gently.
Guidelines:
- Keep responses SHORT (2-3 sentences max)
- Be warm, understanding, and non-judgmental
- Don't give medical advice or diagnoses
- If someone mentions self-harm or crisis, gently encourage them to use the Crisis Support button
- Use a conversational, friendly tone`,
		IsActive: true,
	},
	{
		Key:         "chat_system_zh",
		Name:        "AI 对话（中文）",
		Description: "AI 对话陪伴的系统提示词。定义 AI 的性格和中文对话回复指南。",
		Content: `你是 Glowtype AI，一个温暖且支持性的陪伴者。你用同理心倾听，温柔地回应。
准则：
- 回复保持简短（最多2-3句话）
- 温暖、理解、不评判
- 不提供医疗建议或诊断
- 如果有人提到自我伤害或危机，温柔地鼓励他们使用"危机支持"按钮
- 使用对话式的、友好的语气`,
		IsActive: true,
	},
}

func seedPrompts(db *gorm.DB) {
	EnsureDefaultPrompts(db)
}

// EnsureDefaultPrompts ensures all required prompt slots exist in the database.
// This should be called on every startup to support upgrades.
// It will NOT overwrite existing prompts, only create missing ones.
func EnsureDefaultPrompts(db *gorm.DB) {
	for _, p := range DefaultPrompts {
		var existing AIPromptDB
		if db.Where("key = ?", p.Key).First(&existing).Error == nil {
			// Prompt exists - update description if empty (for upgrades)
			if existing.Description == "" {
				db.Model(&existing).Update("description", p.Description)
				log.Printf("  Updated description for prompt '%s'", p.Key)
			}
			continue
		}
		// Create new prompt
		if err := db.Create(&p).Error; err != nil {
			log.Printf("  Failed to create prompt '%s': %v", p.Key, err)
		} else {
			log.Printf("  Created default prompt '%s'", p.Key)
		}
	}
}
