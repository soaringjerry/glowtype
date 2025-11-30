package database

import (
	"log"

	"gorm.io/gorm"
)

// EnsureDefaultCrisisConfig seeds crisis config if tables are empty
func EnsureDefaultCrisisConfig(db *gorm.DB) {
	var keywordCount int64
	db.Model(&CrisisKeywordDB{}).Count(&keywordCount)
	if keywordCount == 0 {
		log.Println("[CrisisSeed] Seeding default crisis keywords...")
		SeedCrisisKeywords(db)
	}

	var patternCount int64
	db.Model(&CrisisExcludePatternDB{}).Count(&patternCount)
	if patternCount == 0 {
		log.Println("[CrisisSeed] Seeding default exclude patterns...")
		SeedCrisisExcludePatterns(db)
	}

	var resourceCount int64
	db.Model(&CrisisResourceDB{}).Count(&resourceCount)
	if resourceCount == 0 {
		log.Println("[CrisisSeed] Seeding default crisis resources...")
		SeedCrisisResources(db)
	}

	var phraseCount int64
	db.Model(&CrisisForbiddenPhraseDB{}).Count(&phraseCount)
	if phraseCount == 0 {
		log.Println("[CrisisSeed] Seeding default forbidden phrases...")
		SeedCrisisForbiddenPhrases(db)
	}

	var guidanceCount int64
	db.Model(&CrisisGlowtypeGuidanceDB{}).Count(&guidanceCount)
	if guidanceCount == 0 {
		log.Println("[CrisisSeed] Seeding default glowtype guidance...")
		SeedCrisisGlowtypeGuidance(db)
	}

	// Ensure settings exist
	_, _ = GetCrisisSettings(db, nil)
}

// SeedCrisisKeywords populates default crisis keywords
func SeedCrisisKeywords(db *gorm.DB) int {
	keywords := []CrisisKeywordDB{
		// Level 3 - High Risk (EN)
		{Level: 3, Language: "en", Keyword: "want to die", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "en", Keyword: "kill myself", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "en", Keyword: "end my life", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "en", Keyword: "suicide", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "en", Keyword: "don't want to live", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "en", Keyword: "better off dead", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "en", Keyword: "no reason to live", Category: "hopelessness", IsActive: true},
		{Level: 3, Language: "en", Keyword: "can't go on", Category: "hopelessness", IsActive: true},
		{Level: 3, Language: "en", Keyword: "hurt myself", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "en", Keyword: "self harm", Category: "self-harm", IsActive: true},

		// Level 3 - High Risk (ZH)
		{Level: 3, Language: "zh", Keyword: "想死", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "zh", Keyword: "自杀", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "zh", Keyword: "不想活", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "zh", Keyword: "活不下去", Category: "hopelessness", IsActive: true},
		{Level: 3, Language: "zh", Keyword: "结束生命", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "zh", Keyword: "死了算了", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "zh", Keyword: "伤害自己", Category: "self-harm", IsActive: true},
		{Level: 3, Language: "zh", Keyword: "自残", Category: "self-harm", IsActive: true},

		// Level 3 - Slang (ZH)
		{Level: 3, Language: "zh", Keyword: "离开蓝星", Category: "self-harm", IsSlang: true, SlangFor: "想死", IsActive: true},
		{Level: 3, Language: "zh", Keyword: "去见马克思", Category: "self-harm", IsSlang: true, SlangFor: "想死", IsActive: true},
		{Level: 3, Language: "zh", Keyword: "下辈子", Category: "self-harm", IsSlang: true, SlangFor: "想死", IsActive: true},
		{Level: 3, Language: "zh", Keyword: "解脱", Category: "self-harm", IsSlang: true, SlangFor: "想死", IsActive: true},

		// Level 2 - Moderate Risk (EN)
		{Level: 2, Language: "en", Keyword: "hopeless", Category: "hopelessness", IsActive: true},
		{Level: 2, Language: "en", Keyword: "worthless", Category: "hopelessness", IsActive: true},
		{Level: 2, Language: "en", Keyword: "nobody cares", Category: "isolation", IsActive: true},
		{Level: 2, Language: "en", Keyword: "all alone", Category: "isolation", IsActive: true},
		{Level: 2, Language: "en", Keyword: "no point", Category: "hopelessness", IsActive: true},
		{Level: 2, Language: "en", Keyword: "give up", Category: "hopelessness", IsActive: true},
		{Level: 2, Language: "en", Keyword: "can't take it anymore", Category: "hopelessness", IsActive: true},
		{Level: 2, Language: "en", Keyword: "trapped", Category: "hopelessness", IsActive: true},

		// Level 2 - Moderate Risk (ZH)
		{Level: 2, Language: "zh", Keyword: "绝望", Category: "hopelessness", IsActive: true},
		{Level: 2, Language: "zh", Keyword: "没人关心", Category: "isolation", IsActive: true},
		{Level: 2, Language: "zh", Keyword: "活着没意思", Category: "hopelessness", IsActive: true},
		{Level: 2, Language: "zh", Keyword: "好累", Category: "hopelessness", IsActive: true},
		{Level: 2, Language: "zh", Keyword: "撑不下去", Category: "hopelessness", IsActive: true},
		{Level: 2, Language: "zh", Keyword: "没人懂", Category: "isolation", IsActive: true},
		{Level: 2, Language: "zh", Keyword: "无所谓了", Category: "hopelessness", IsActive: true},
		{Level: 2, Language: "zh", Keyword: "放弃", Category: "hopelessness", IsActive: true},

		// Level 1 - Low Risk (EN)
		{Level: 1, Language: "en", Keyword: "stressed", Category: "general", IsActive: true},
		{Level: 1, Language: "en", Keyword: "anxious", Category: "general", IsActive: true},
		{Level: 1, Language: "en", Keyword: "depressed", Category: "general", IsActive: true},
		{Level: 1, Language: "en", Keyword: "overwhelmed", Category: "general", IsActive: true},
		{Level: 1, Language: "en", Keyword: "exhausted", Category: "general", IsActive: true},

		// Level 1 - Low Risk (ZH)
		{Level: 1, Language: "zh", Keyword: "压力大", Category: "general", IsActive: true},
		{Level: 1, Language: "zh", Keyword: "焦虑", Category: "general", IsActive: true},
		{Level: 1, Language: "zh", Keyword: "抑郁", Category: "general", IsActive: true},
		{Level: 1, Language: "zh", Keyword: "烦躁", Category: "general", IsActive: true},
		{Level: 1, Language: "zh", Keyword: "心情不好", Category: "general", IsActive: true},
	}

	db.Create(&keywords)
	return len(keywords)
}

// SeedCrisisExcludePatterns populates default exclude patterns
func SeedCrisisExcludePatterns(db *gorm.DB) int {
	patterns := []CrisisExcludePatternDB{
		// English patterns
		{Pattern: "was feeling", PatternType: "contains", Description: "Past tense", Language: "en", IsActive: true},
		{Pattern: "used to feel", PatternType: "contains", Description: "Past tense", Language: "en", IsActive: true},
		{Pattern: "my friend", PatternType: "contains", Description: "Third person", Language: "en", IsActive: true},
		{Pattern: "someone I know", PatternType: "contains", Description: "Third person", Language: "en", IsActive: true},
		{Pattern: "in a movie", PatternType: "contains", Description: "Fiction context", Language: "en", IsActive: true},
		{Pattern: "in a book", PatternType: "contains", Description: "Fiction context", Language: "en", IsActive: true},
		{Pattern: "\"", PatternType: "contains", Description: "Quoted text", Language: "en", IsActive: true},

		// Chinese patterns
		{Pattern: "以前", PatternType: "contains", Description: "Past tense", Language: "zh", IsActive: true},
		{Pattern: "曾经", PatternType: "contains", Description: "Past tense", Language: "zh", IsActive: true},
		{Pattern: "我朋友", PatternType: "contains", Description: "Third person", Language: "zh", IsActive: true},
		{Pattern: "有人说", PatternType: "contains", Description: "Third person", Language: "zh", IsActive: true},
		{Pattern: "电影里", PatternType: "contains", Description: "Fiction context", Language: "zh", IsActive: true},
		{Pattern: "书里", PatternType: "contains", Description: "Fiction context", Language: "zh", IsActive: true},
		{Pattern: "小说", PatternType: "contains", Description: "Fiction context", Language: "zh", IsActive: true},
		{Pattern: "\u201c", PatternType: "contains", Description: "Quoted text (Chinese left quote)", Language: "zh", IsActive: true},
		{Pattern: "\u201d", PatternType: "contains", Description: "Quoted text (Chinese right quote)", Language: "zh", IsActive: true},
	}

	db.Create(&patterns)
	return len(patterns)
}

// SeedCrisisResources populates default crisis resources
func SeedCrisisResources(db *gorm.DB) int {
	resources := []CrisisResourceDB{
		// China
		{Country: "CN", Name: "Beijing Psychological Crisis Research and Intervention Center", NameZh: "北京心理危机研究与干预中心", Phone: "010-82951332", Hours: "24/7", Priority: 100, IsActive: true},
		{Country: "CN", Name: "National Mental Health Hotline", NameZh: "全国心理援助热线", Phone: "400-161-9995", Hours: "24/7", Priority: 90, IsActive: true},
		{Country: "CN", Name: "Hope 24 Hotline", NameZh: "希望24热线", Phone: "400-161-9995", Hours: "24/7", Priority: 80, IsActive: true},

		// Singapore
		{Country: "SG", Name: "Samaritans of Singapore", Phone: "1800-221-4444", Hours: "24/7", Priority: 100, IsActive: true},
		{Country: "SG", Name: "Institute of Mental Health", Phone: "6389-2222", Hours: "24/7", Priority: 90, IsActive: true},
		{Country: "SG", Name: "TOUCHline", Phone: "1800-377-2252", Hours: "24/7", Priority: 80, IsActive: true},

		// United States
		{Country: "US", Name: "National Suicide Prevention Lifeline", Phone: "988", Hours: "24/7", Priority: 100, IsActive: true},
		{Country: "US", Name: "Crisis Text Line", Phone: "Text HOME to 741741", Hours: "24/7", Priority: 90, IsActive: true},
		{Country: "US", Name: "Trevor Project (LGBTQ+)", Phone: "1-866-488-7386", Hours: "24/7", Priority: 80, IsActive: true},

		// United Kingdom
		{Country: "UK", Name: "Samaritans UK", Phone: "116 123", Hours: "24/7", Priority: 100, IsActive: true},
		{Country: "UK", Name: "CALM", Phone: "0800 58 58 58", Hours: "5pm-midnight", Priority: 90, IsActive: true},
		{Country: "UK", Name: "Papyrus HOPELINEUK", Phone: "0800 068 41 41", Hours: "9am-midnight", Priority: 80, IsActive: true},

		// Taiwan
		{Country: "TW", Name: "Taiwan Suicide Prevention Hotline", NameZh: "安心专线", Phone: "1925", Hours: "24/7", Priority: 100, IsActive: true},
		{Country: "TW", Name: "Lifeline Taiwan", NameZh: "生命线", Phone: "1995", Hours: "24/7", Priority: 90, IsActive: true},

		// Hong Kong
		{Country: "HK", Name: "Samaritan Befrienders", NameZh: "撒玛利亚防止自杀会", Phone: "2389 2222", Hours: "24/7", Priority: 100, IsActive: true},
		{Country: "HK", Name: "Suicide Prevention Services", NameZh: "生命热线", Phone: "2382 0000", Hours: "24/7", Priority: 90, IsActive: true},

		// Malaysia
		{Country: "MY", Name: "Befrienders KL", Phone: "03-7956 8145", Hours: "24/7", Priority: 100, IsActive: true},
		{Country: "MY", Name: "MIASA Crisis Helpline", Phone: "1-800-18-0066", Hours: "24/7", Priority: 90, IsActive: true},

		// Australia
		{Country: "AU", Name: "Lifeline Australia", Phone: "13 11 14", Hours: "24/7", Priority: 100, IsActive: true},
		{Country: "AU", Name: "Beyond Blue", Phone: "1300 22 4636", Hours: "24/7", Priority: 90, IsActive: true},
		{Country: "AU", Name: "Kids Helpline", Phone: "1800 55 1800", Hours: "24/7", Priority: 80, IsActive: true},

		// Canada
		{Country: "CA", Name: "Canada Suicide Prevention Service", Phone: "1-833-456-4566", Hours: "24/7", Priority: 100, IsActive: true},
		{Country: "CA", Name: "Kids Help Phone", Phone: "1-800-668-6868", Hours: "24/7", Priority: 90, IsActive: true},

		// Japan
		{Country: "JP", Name: "TELL Lifeline", NameZh: "东京英语生命热线", Phone: "03-5774-0992", Hours: "9am-11pm", Priority: 100, IsActive: true},
		{Country: "JP", Name: "Inochi no Denwa", NameZh: "命の電話", Phone: "0120-783-556", Hours: "24/7", Priority: 90, IsActive: true},

		// Korea
		{Country: "KR", Name: "Korea Suicide Prevention Hotline", NameZh: "韩国自杀预防热线", Phone: "1393", Hours: "24/7", Priority: 100, IsActive: true},

		// Global fallback
		{Country: "GLOBAL", Name: "International Association for Suicide Prevention", URL: "https://www.iasp.info/resources/Crisis_Centres/", Hours: "24/7", Priority: 50, IsActive: true},
		{Country: "GLOBAL", Name: "Befrienders Worldwide", URL: "https://www.befrienders.org/", Hours: "24/7", Priority: 40, IsActive: true},
	}

	db.Create(&resources)
	return len(resources)
}

// SeedCrisisForbiddenPhrases populates default forbidden phrases
func SeedCrisisForbiddenPhrases(db *gorm.DB) int {
	phrases := []CrisisForbiddenPhraseDB{
		// English - Diagnosis
		{Language: "en", Phrase: "you have depression", Alternative: "It sounds like you're going through something difficult", Category: "diagnosis", IsActive: true},
		{Language: "en", Phrase: "you have anxiety", Alternative: "I can hear that you're feeling anxious", Category: "diagnosis", IsActive: true},
		{Language: "en", Phrase: "you have PTSD", Alternative: "What you've experienced sounds really tough", Category: "diagnosis", IsActive: true},
		{Language: "en", Phrase: "you need to see a doctor", Alternative: "Talking to someone who specializes in this might be helpful", Category: "diagnosis", IsActive: true},
		{Language: "en", Phrase: "you should get therapy", Alternative: "There are people who are trained to help with these feelings", Category: "diagnosis", IsActive: true},

		// English - Dismissive
		{Language: "en", Phrase: "don't worry", Alternative: "I can see this is weighing on you", Category: "dismissive", IsActive: true},
		{Language: "en", Phrase: "don't be sad", Alternative: "It's okay to feel this way", Category: "dismissive", IsActive: true},
		{Language: "en", Phrase: "it's not that bad", Alternative: "What you're feeling is real and valid", Category: "dismissive", IsActive: true},
		{Language: "en", Phrase: "others have it worse", Alternative: "Your feelings matter", Category: "dismissive", IsActive: true},
		{Language: "en", Phrase: "just relax", Alternative: "Take your time", Category: "dismissive", IsActive: true},
		{Language: "en", Phrase: "get over it", Alternative: "I hear you", Category: "dismissive", IsActive: true},
		{Language: "en", Phrase: "snap out of it", Alternative: "I'm here with you", Category: "dismissive", IsActive: true},

		// English - Toxic Positivity
		{Language: "en", Phrase: "cheer up", Alternative: "It's okay to feel this way", Category: "toxic_positivity", IsActive: true},
		{Language: "en", Phrase: "look on the bright side", Alternative: "I understand this is hard", Category: "toxic_positivity", IsActive: true},
		{Language: "en", Phrase: "everything happens for a reason", Alternative: "Sometimes things just feel overwhelming", Category: "toxic_positivity", IsActive: true},
		{Language: "en", Phrase: "time heals all wounds", Alternative: "I'm here with you right now", Category: "toxic_positivity", IsActive: true},
		{Language: "en", Phrase: "just think positive", Alternative: "Your feelings are valid", Category: "toxic_positivity", IsActive: true},

		// English - Invalidating
		{Language: "en", Phrase: "you're overreacting", Alternative: "This clearly affects you deeply", Category: "invalidating", IsActive: true},
		{Language: "en", Phrase: "it could be worse", Alternative: "What you're experiencing is real", Category: "invalidating", IsActive: true},
		{Language: "en", Phrase: "I completely understand", Alternative: "I hear you", Category: "invalidating", IsActive: true},
		{Language: "en", Phrase: "I know exactly how you feel", Alternative: "Thank you for sharing this with me", Category: "invalidating", IsActive: true},

		// Chinese - Diagnosis
		{Language: "zh", Phrase: "你有抑郁症", Alternative: "听起来你正在经历一些困难", Category: "diagnosis", IsActive: true},
		{Language: "zh", Phrase: "你有焦虑症", Alternative: "我能感受到你很焦虑", Category: "diagnosis", IsActive: true},
		{Language: "zh", Phrase: "你需要看医生", Alternative: "和专业人士聊聊可能会有帮助", Category: "diagnosis", IsActive: true},
		{Language: "zh", Phrase: "你应该去治疗", Alternative: "有些人专门帮助处理这些感受", Category: "diagnosis", IsActive: true},

		// Chinese - Dismissive
		{Language: "zh", Phrase: "别担心", Alternative: "我能感受到这对你很重要", Category: "dismissive", IsActive: true},
		{Language: "zh", Phrase: "别难过", Alternative: "这样感受是可以的", Category: "dismissive", IsActive: true},
		{Language: "zh", Phrase: "没那么严重", Alternative: "你的感受是真实的", Category: "dismissive", IsActive: true},
		{Language: "zh", Phrase: "别人比你更惨", Alternative: "你的感受很重要", Category: "dismissive", IsActive: true},
		{Language: "zh", Phrase: "放松", Alternative: "慢慢来", Category: "dismissive", IsActive: true},

		// Chinese - Toxic Positivity
		{Language: "zh", Phrase: "振作起来", Alternative: "这样感受是可以的", Category: "toxic_positivity", IsActive: true},
		{Language: "zh", Phrase: "想开点", Alternative: "我理解这很难", Category: "toxic_positivity", IsActive: true},
		{Language: "zh", Phrase: "开心点", Alternative: "我在这里陪着你", Category: "toxic_positivity", IsActive: true},
		{Language: "zh", Phrase: "往好处想", Alternative: "你的感受是真实的", Category: "toxic_positivity", IsActive: true},
		{Language: "zh", Phrase: "一切都会好的", Alternative: "我现在陪着你", Category: "toxic_positivity", IsActive: true},
		{Language: "zh", Phrase: "时间会治愈一切", Alternative: "我在这里听你说", Category: "toxic_positivity", IsActive: true},

		// Chinese - Invalidating
		{Language: "zh", Phrase: "你想太多了", Alternative: "这对你影响很深", Category: "invalidating", IsActive: true},
		{Language: "zh", Phrase: "没什么大不了", Alternative: "你经历的是真实的", Category: "invalidating", IsActive: true},
		{Language: "zh", Phrase: "你太敏感了", Alternative: "你的感受很重要", Category: "invalidating", IsActive: true},
		{Language: "zh", Phrase: "我完全理解你的感受", Alternative: "我听到了", Category: "invalidating", IsActive: true},
	}

	db.Create(&phrases)
	return len(phrases)
}

// SeedCrisisGlowtypeGuidance populates default glowtype guidance
func SeedCrisisGlowtypeGuidance(db *gorm.DB) int {
	guidance := []CrisisGlowtypeGuidanceDB{
		// Radiant Nebula - English
		{GlowtypeCode: "radiant-nebula", Language: "en", FieldType: "energyStyle", Content: "You get energy from connecting with others and social interaction. Being around people recharges you.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "radiant-nebula", Language: "en", FieldType: "expressionStyle", Content: "You express emotions openly and enjoy sharing your thoughts and feelings with others.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "radiant-nebula", Language: "en", FieldType: "metaphor", Content: "You're like a warm sun - your light reaches everyone around you, bringing warmth wherever you go.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "radiant-nebula", Language: "en", FieldType: "metaphor", Content: "Your energy is like a flowing river - vibrant, full of life, and naturally drawing others in.", DisplayOrder: 1, IsActive: true},
		{GlowtypeCode: "radiant-nebula", Language: "en", FieldType: "selfCareTip", Content: "Remember to save some alone time for yourself - even sunshine needs moments of rest.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "radiant-nebula", Language: "en", FieldType: "selfCareTip", Content: "When you feel overwhelmed, it's okay to dim your light temporarily to recharge.", DisplayOrder: 1, IsActive: true},

		// Radiant Nebula - Chinese
		{GlowtypeCode: "radiant-nebula", Language: "zh", FieldType: "energyStyle", Content: "你从与他人的连接和社交互动中获得能量。和人在一起会让你充电。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "radiant-nebula", Language: "zh", FieldType: "expressionStyle", Content: "你喜欢开放地表达情感，享受与他人分享你的想法和感受。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "radiant-nebula", Language: "zh", FieldType: "metaphor", Content: "你就像温暖的阳光——你的光芒能照到周围每一个人。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "radiant-nebula", Language: "zh", FieldType: "metaphor", Content: "你的能量像流动的河流——充满活力，自然地吸引着身边的人。", DisplayOrder: 1, IsActive: true},
		{GlowtypeCode: "radiant-nebula", Language: "zh", FieldType: "selfCareTip", Content: "允许自己真正休息一下，而不是一直\"撑着\"。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "radiant-nebula", Language: "zh", FieldType: "selfCareTip", Content: "当你觉得能量耗尽时，暂时安静下来也是一种照顾自己的方式。", DisplayOrder: 1, IsActive: true},

		// Quiet Comet - English
		{GlowtypeCode: "quiet-comet", Language: "en", FieldType: "energyStyle", Content: "You recharge through solitude and prefer your own space. Being alone helps you restore your energy.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "quiet-comet", Language: "en", FieldType: "expressionStyle", Content: "You keep emotions close and have a rich inner world. You process things deeply before sharing.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "quiet-comet", Language: "en", FieldType: "metaphor", Content: "You're like a comet - moving through your own orbit, deep and mysterious, with hidden beauty.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "quiet-comet", Language: "en", FieldType: "metaphor", Content: "Your inner world is like a vast ocean - calm on the surface but full of incredible depth beneath.", DisplayOrder: 1, IsActive: true},
		{GlowtypeCode: "quiet-comet", Language: "en", FieldType: "selfCareTip", Content: "Your need for alone time is completely valid - it's how you recharge and process.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "quiet-comet", Language: "en", FieldType: "selfCareTip", Content: "Try sharing just one small thing with someone you trust - you don't have to share everything at once.", DisplayOrder: 1, IsActive: true},

		// Quiet Comet - Chinese
		{GlowtypeCode: "quiet-comet", Language: "zh", FieldType: "energyStyle", Content: "你通过独处来恢复能量，喜欢拥有自己的空间。独处帮助你恢复精力。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "quiet-comet", Language: "zh", FieldType: "expressionStyle", Content: "你把情感藏在心里，有丰富的内心世界。你在分享之前会深入思考。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "quiet-comet", Language: "zh", FieldType: "metaphor", Content: "你就像一颗彗星——在自己的轨道上运行，深邃而神秘。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "quiet-comet", Language: "zh", FieldType: "metaphor", Content: "你的内心世界像深海——表面平静，但里面藏着无限深度。", DisplayOrder: 1, IsActive: true},
		{GlowtypeCode: "quiet-comet", Language: "zh", FieldType: "selfCareTip", Content: "你需要独处的时间是完全正常的——这是你恢复能量的方式。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "quiet-comet", Language: "zh", FieldType: "selfCareTip", Content: "可以尝试只分享一件小事给你信任的人，而不是一次说完所有。", DisplayOrder: 1, IsActive: true},

		// Hidden Aurora - English
		{GlowtypeCode: "hidden-aurora", Language: "en", FieldType: "energyStyle", Content: "You enjoy solitude but have a lot to express inside. You're an introvert with a creative soul.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "hidden-aurora", Language: "en", FieldType: "expressionStyle", Content: "You may express better through creative outlets like writing, art, or music rather than talking.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "hidden-aurora", Language: "en", FieldType: "metaphor", Content: "You're like an aurora - beautiful colors hidden until the right moment, then you light up the sky.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "hidden-aurora", Language: "en", FieldType: "metaphor", Content: "Your creativity is like underground rivers - powerful and flowing even when unseen by others.", DisplayOrder: 1, IsActive: true},
		{GlowtypeCode: "hidden-aurora", Language: "en", FieldType: "selfCareTip", Content: "Find your own way to express - writing, art, or music can be powerful outlets for what's inside.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "hidden-aurora", Language: "en", FieldType: "selfCareTip", Content: "You don't have to be face-to-face to share what's inside. Your creations speak for you.", DisplayOrder: 1, IsActive: true},

		// Hidden Aurora - Chinese
		{GlowtypeCode: "hidden-aurora", Language: "zh", FieldType: "energyStyle", Content: "你享受独处，但内心有很多想要表达的东西。你是一个有创造力灵魂的内向者。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "hidden-aurora", Language: "zh", FieldType: "expressionStyle", Content: "你可能更擅长通过创作（如写作、艺术、音乐）来表达，而不是说话。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "hidden-aurora", Language: "zh", FieldType: "metaphor", Content: "你就像极光——美丽的色彩隐藏着，等到合适的时刻才会绽放。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "hidden-aurora", Language: "zh", FieldType: "metaphor", Content: "你的创造力像地下河——即使看不见，依然强大而流动。", DisplayOrder: 1, IsActive: true},
		{GlowtypeCode: "hidden-aurora", Language: "zh", FieldType: "selfCareTip", Content: "找到适合你的表达方式，不一定要面对面，写作或创作也是很好的出口。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "hidden-aurora", Language: "zh", FieldType: "selfCareTip", Content: "允许自己用感觉舒适的方式来表达，不需要遵循别人的规则。", DisplayOrder: 1, IsActive: true},

		// Warm Ember - English
		{GlowtypeCode: "warm-ember", Language: "en", FieldType: "energyStyle", Content: "You enjoy being around others but aren't always verbal. You like company but don't need to fill silence.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "warm-ember", Language: "en", FieldType: "expressionStyle", Content: "You show care through actions more than words. Your presence itself is comforting to others.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "warm-ember", Language: "en", FieldType: "metaphor", Content: "You're like a warm ember - steady warmth that people feel without seeing the flame.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "warm-ember", Language: "en", FieldType: "metaphor", Content: "Your presence is like a cozy blanket - comforting without needing words.", DisplayOrder: 1, IsActive: true},
		{GlowtypeCode: "warm-ember", Language: "en", FieldType: "selfCareTip", Content: "Try telling people how you feel in simple words - they'll be happy to know what you're thinking.", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "warm-ember", Language: "en", FieldType: "selfCareTip", Content: "Your actions speak loudly - but sometimes words can create even deeper connections.", DisplayOrder: 1, IsActive: true},

		// Warm Ember - Chinese
		{GlowtypeCode: "warm-ember", Language: "zh", FieldType: "energyStyle", Content: "你喜欢和别人在一起，但不总是需要说话。你喜欢陪伴但不需要填满沉默。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "warm-ember", Language: "zh", FieldType: "expressionStyle", Content: "你更多通过行动而不是言语来表达关心。你的存在本身就让人感到安慰。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "warm-ember", Language: "zh", FieldType: "metaphor", Content: "你就像温暖的余烬——稳定的温暖，人们感受得到却看不见火焰。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "warm-ember", Language: "zh", FieldType: "metaphor", Content: "你的存在就像一条舒适的毯子——不需要言语就能让人安心。", DisplayOrder: 1, IsActive: true},
		{GlowtypeCode: "warm-ember", Language: "zh", FieldType: "selfCareTip", Content: "试着用简单的话告诉身边的人你的感受，他们会很高兴知道你在想什么。", DisplayOrder: 0, IsActive: true},
		{GlowtypeCode: "warm-ember", Language: "zh", FieldType: "selfCareTip", Content: "你的行动已经说明了很多——但有时候言语可以创造更深的连接。", DisplayOrder: 1, IsActive: true},
	}

	db.Create(&guidance)
	return len(guidance)
}
