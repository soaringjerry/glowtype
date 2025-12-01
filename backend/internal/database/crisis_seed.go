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

	var scriptCount int64
	db.Model(&CrisisScriptDB{}).Count(&scriptCount)
	if scriptCount == 0 {
		log.Println("[CrisisSeed] Seeding example crisis scripts...")
		SeedCrisisScripts(db)
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

// SeedCrisisScripts populates comprehensive conversation scripts
// Following the four-step pattern: Listen → Empathize → Confirm → Refer
func SeedCrisisScripts(db *gorm.DB) int {
	scripts := []CrisisScriptDB{
		// ============ Level 3: Self-harm/Suicide ideation (High Risk) ============
		// Chinese scripts
		{
			Title:        "想死的念头 - 直接回应",
			TitleZh:      "想死的念头 - 直接回应",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "zh",
			CrisisLevels: "[3]",
			DisplayOrder: 1,
			Content:      "[Listen] I hear that you're having thoughts about not wanting to live. That took courage to share.\n[Empathize] Carrying these thoughts must be incredibly heavy. Your pain is real.\n[Confirm] Can you tell me more about what's bringing these feelings up?\n[Refer] While I'm here with you, there are people trained specifically for this who can help more - they're available 24/7.",
			ContentZh:    "【倾听】我听到你说有不想活的念头。能说出来需要很大的勇气。\n【共情】承载这些想法一定非常沉重。你的痛苦是真实的。\n【确认】你能告诉我更多是什么让你有这样的感觉吗？\n【转介】在我陪着你的同时，有专门受过训练的人可以提供更多帮助——他们24小时都在。",
			IsActive:     true,
		},
		{
			Title:        "自伤冲动 - 安全优先",
			TitleZh:      "自伤冲动 - 安全优先",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "zh",
			CrisisLevels: "[3]",
			DisplayOrder: 2,
			Content:      "[Listen] Thank you for being honest about these urges. I'm glad you're talking about it.\n[Empathize] Having these urges doesn't make you broken - it means you're in real pain.\n[Confirm] Right now, are you safe? Is there anything nearby that worries you?\n[Refer] The crisis line can help you find ways to stay safe tonight.",
			ContentZh:    "【倾听】谢谢你愿意诚实地说出这些冲动。我很高兴你愿意谈论它。\n【共情】有这些冲动并不意味着你坏了——这说明你正在承受真实的痛苦。\n【确认】现在，你安全吗？身边有什么让你担心的东西吗？\n【转介】危机热线可以帮助你找到今晚保持安全的方法。",
			IsActive:     true,
		},
		{
			Title:        "结束生命的计划 - 紧急转介",
			TitleZh:      "结束生命的计划 - 紧急转介",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "zh",
			CrisisLevels: "[3]",
			DisplayOrder: 3,
			Content:      "[Listen] I'm really glad you're telling me this. It shows strength.\n[Empathize] The pain you're in must feel unbearable right now.\n[Confirm] I want to make sure I understand - do you have a plan for how you might hurt yourself?\n[Refer] I really need you to talk to someone who can help keep you safe right now. Can we call the crisis line together?",
			ContentZh:    "【倾听】我真的很高兴你告诉我这些。这显示了力量。\n【共情】你现在的痛苦一定感觉难以承受。\n【确认】我想确认我理解了——你有伤害自己的具体计划吗？\n【转介】我真的需要你现在和能帮助你保持安全的人谈谈。我们可以一起拨打危机热线吗？",
			IsActive:     true,
		},
		{
			Title:        "活着太累了",
			TitleZh:      "活着太累了",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "zh",
			CrisisLevels: "[3]",
			DisplayOrder: 4,
			Content:      "[Listen] I hear how exhausted you are. Living shouldn't feel this hard.\n[Empathize] Feeling this tired of life... that's a heavy weight to carry every day.\n[Confirm] When did things start feeling this hard?\n[Refer] There are people who help with exactly this kind of exhaustion. Would you be open to hearing about them?",
			ContentZh:    "【倾听】我听到你有多疲惫。活着不应该这么难。\n【共情】对生活感到如此疲倦……每天背负这样的重量太沉重了。\n【确认】事情是什么时候开始变得这么难的？\n【转介】有些人专门帮助处理这种疲惫。你愿意听听关于他们的事吗？",
			IsActive:     true,
		},
		{
			Title:        "没有人会在意",
			TitleZh:      "没有人会在意",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "zh",
			CrisisLevels: "[3]",
			DisplayOrder: 5,
			Content:      "[Listen] I hear that you feel invisible, like no one would notice.\n[Empathize] Feeling unseen is one of the loneliest pains there is.\n[Confirm] I notice you. I'm here. Can you tell me more about what's making you feel this way?\n[Refer] There are people whose whole job is to see and support people going through this. They care.",
			ContentZh:    "【倾听】我听到你觉得自己是隐形的，好像没有人会注意到。\n【共情】感觉不被看见是最孤独的痛苦之一。\n【确认】我注意到你了。我在这里。你能告诉我更多是什么让你有这种感觉吗？\n【转介】有些人的工作就是看到和支持正在经历这些的人。他们在乎。",
			IsActive:     true,
		},
		{
			Title:        "想离开这个世界",
			TitleZh:      "想离开这个世界",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "zh",
			CrisisLevels: "[3]",
			DisplayOrder: 6,
			Content:      "[Listen] I hear you want the pain to stop. That's what I'm hearing.\n[Empathize] The pain must be so intense that leaving feels like the only option.\n[Confirm] What would need to change for staying to feel possible?\n[Refer] Professional counselors can help explore other ways through this pain. Would you consider talking to one?",
			ContentZh:    "【倾听】我听到你想让痛苦停止。这是我听到的。\n【共情】痛苦一定非常强烈，以至于离开感觉是唯一的选择。\n【确认】需要什么改变才能让留下来成为可能？\n【转介】专业的咨询师可以帮助探索其他度过这种痛苦的方法。你会考虑和一位谈谈吗？",
			IsActive:     true,
		},
		// English Level 3 scripts
		{
			Title:        "Suicidal thoughts - Direct response",
			TitleZh:      "自杀念头 - 直接回应",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "en",
			CrisisLevels: "[3]",
			DisplayOrder: 7,
			Content:      "[Listen] I hear that you're having thoughts about ending your life. Thank you for trusting me with this.\n[Empathize] Carrying these thoughts alone must have been so heavy.\n[Confirm] Can you help me understand what's bringing these feelings up right now?\n[Refer] There are people trained specifically for this moment who are available 24/7. Would you be open to connecting with them?",
			ContentZh:    "【倾听】我听到你有结束生命的想法。谢谢你信任我告诉我这些。\n【共情】独自承载这些想法一定很沉重。\n【确认】你能帮我理解现在是什么引发了这些感受吗？\n【转介】有专门受过培训的人24小时待命。你愿意联系他们吗？",
			IsActive:     true,
		},
		{
			Title:        "Self-harm urges - Safety first",
			TitleZh:      "自伤冲动 - 安全优先",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "en",
			CrisisLevels: "[3]",
			DisplayOrder: 8,
			Content:      "[Listen] I'm really glad you're talking about this. It takes courage.\n[Empathize] These urges don't define you - they're telling us you're in a lot of pain.\n[Confirm] Right now, are you in a safe place? Do you have access to anything that worries you?\n[Refer] A crisis counselor can help you find ways to stay safe tonight. Can I share their number?",
			ContentZh:    "【倾听】我真的很高兴你愿意谈论这个。这需要勇气。\n【共情】这些冲动不能定义你——它们告诉我们你正在承受很多痛苦。\n【确认】现在，你在一个安全的地方吗？你能接触到任何让你担心的东西吗？\n【转介】危机咨询师可以帮你找到今晚保持安全的方法。我可以分享他们的号码吗？",
			IsActive:     true,
		},
		{
			Title:        "Feeling like a burden",
			TitleZh:      "觉得自己是负担",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "en",
			CrisisLevels: "[3]",
			DisplayOrder: 9,
			Content:      "[Listen] I hear you saying you feel like a burden. That must be such a painful way to see yourself.\n[Empathize] When we're hurting, our minds can tell us lies about our worth. You are not a burden.\n[Confirm] Can you tell me what's making you feel this way about yourself?\n[Refer] There are people who specialize in helping with these exact feelings. They can help you see yourself more clearly.",
			ContentZh:    "【倾听】我听到你说觉得自己是个负担。这一定是看待自己非常痛苦的方式。\n【共情】当我们受伤时，我们的大脑会对我们的价值撒谎。你不是负担。\n【确认】你能告诉我是什么让你这样看待自己吗？\n【转介】有专门帮助处理这些感受的人。他们可以帮你更清楚地看到自己。",
			IsActive:     true,
		},
		{
			Title:        "Want the pain to stop",
			TitleZh:      "想让痛苦停止",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "en",
			CrisisLevels: "[3]",
			DisplayOrder: 10,
			Content:      "[Listen] I hear that you want the pain to end. That makes complete sense.\n[Empathize] The pain must feel absolutely unbearable right now.\n[Confirm] What does this pain feel like? Where does it hurt most?\n[Refer] There are other ways to ease this pain. Would you talk to someone who knows how to help with this?",
			ContentZh:    "【倾听】我听到你想让痛苦结束。这完全可以理解。\n【共情】现在的痛苦一定感觉绝对无法忍受。\n【确认】这种痛苦是什么感觉？哪里最痛？\n【转介】还有其他方法可以缓解这种痛苦。你愿意和知道如何帮助的人谈谈吗？",
			IsActive:     true,
		},
		{
			Title:        "Nobody would care if I'm gone",
			TitleZh:      "我走了没人会在意",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "en",
			CrisisLevels: "[3]",
			DisplayOrder: 11,
			Content:      "[Listen] I hear that you believe no one would notice or care. That feeling is real.\n[Empathize] Feeling invisible and unloved is one of the deepest pains there is.\n[Confirm] I care. I'm here with you right now. What happened that makes you feel so unseen?\n[Refer] Crisis counselors see you too. They're available right now and they genuinely care.",
			ContentZh:    "【倾听】我听到你相信没有人会注意到或在乎。这种感觉是真实的。\n【共情】感觉隐形和不被爱是最深的痛苦之一。\n【确认】我在乎。我现在在这里陪着你。发生了什么让你感觉如此不被看见？\n【转介】危机咨询师也看到你了。他们现在就在线，他们真的在乎。",
			IsActive:     true,
		},
		{
			Title:        "I've tried everything",
			TitleZh:      "我什么都试过了",
			Mode:         "reference",
			Category:     "level3-selfharm",
			Language:     "en",
			CrisisLevels: "[3]",
			DisplayOrder: 12,
			Content:      "[Listen] I hear how exhausted you are from trying. You've been fighting hard.\n[Empathize] Feeling like nothing works is so discouraging. Your effort is real and valid.\n[Confirm] What have you tried? What helped even a little bit?\n[Refer] Sometimes we need different tools or support. Professional help can offer new approaches you haven't tried yet.",
			ContentZh:    "【倾听】我听到你尝试了多少次有多疲惫。你一直在努力战斗。\n【共情】感觉什么都不管用是如此令人沮丧。你的努力是真实的、有价值的。\n【确认】你尝试过什么？有什么哪怕帮了一点点？\n【转介】有时我们需要不同的工具或支持。专业帮助可以提供你还没试过的新方法。",
			IsActive:     true,
		},

		// ============ Level 2: Hopelessness/Isolation (Moderate Risk) ============
		// Chinese Level 2 scripts
		{
			Title:        "感到绝望",
			TitleZh:      "感到绝望",
			Mode:         "reference",
			Category:     "level2-hopelessness",
			Language:     "zh",
			CrisisLevels: "[2]",
			DisplayOrder: 20,
			Content:      "[Listen] I hear that everything feels hopeless right now.\n[Empathize] When we can't see a way forward, everything feels heavier.\n[Confirm] What would feeling hopeful look like for you?",
			ContentZh:    "【倾听】我听到现在一切都感觉没有希望。\n【共情】当我们看不到前进的路时，一切都感觉更沉重。\n【确认】对你来说，有希望是什么样子的？",
			IsActive:     true,
		},
		{
			Title:        "没人理解我",
			TitleZh:      "没人理解我",
			Mode:         "reference",
			Category:     "level2-isolation",
			Language:     "zh",
			CrisisLevels: "[2]",
			DisplayOrder: 21,
			Content:      "[Listen] Feeling misunderstood is so isolating. I hear you.\n[Empathize] It's exhausting to explain yourself and still feel unseen.\n[Confirm] Can you tell me what you wish people understood about you?",
			ContentZh:    "【倾听】感觉不被理解是如此孤立。我听到了。\n【共情】解释自己却仍然感觉不被看见是很累人的。\n【确认】你能告诉我你希望人们理解你什么吗？",
			IsActive:     true,
		},
		{
			Title:        "活着没意思",
			TitleZh:      "活着没意思",
			Mode:         "reference",
			Category:     "level2-hopelessness",
			Language:     "zh",
			CrisisLevels: "[2]",
			DisplayOrder: 22,
			Content:      "[Listen] I hear that life feels empty and meaningless right now.\n[Empathize] When everything feels flat, it's hard to find reasons to engage.\n[Confirm] Was there ever a time when things felt meaningful? What was different then?",
			ContentZh:    "【倾听】我听到生活现在感觉空虚和没有意义。\n【共情】当一切都感觉平淡时，很难找到参与的理由。\n【确认】有没有一段时间事情感觉有意义？那时有什么不同？",
			IsActive:     true,
		},
		{
			Title:        "撑不下去了",
			TitleZh:      "撑不下去了",
			Mode:         "reference",
			Category:     "level2-hopelessness",
			Language:     "zh",
			CrisisLevels: "[2]",
			DisplayOrder: 23,
			Content:      "[Listen] I hear that you're at the end of your rope.\n[Empathize] You've been holding on through so much. That takes real strength.\n[Confirm] What's been the hardest part to carry?",
			ContentZh:    "【倾听】我听到你已经到了极限。\n【共情】你一直在坚持那么多。这需要真正的力量。\n【确认】最难承受的部分是什么？",
			IsActive:     true,
		},
		{
			Title:        "我很孤独",
			TitleZh:      "我很孤独",
			Mode:         "reference",
			Category:     "level2-isolation",
			Language:     "zh",
			CrisisLevels: "[2]",
			DisplayOrder: 24,
			Content:      "[Listen] Loneliness is one of the hardest feelings to carry.\n[Empathize] You can be surrounded by people and still feel completely alone.\n[Confirm] What kind of connection would feel good right now?",
			ContentZh:    "【倾听】孤独是最难承受的感觉之一。\n【共情】你可以被人包围但仍然感觉完全孤独。\n【确认】什么样的连接现在会让你感觉好一点？",
			IsActive:     true,
		},
		{
			Title:        "我放弃了",
			TitleZh:      "我放弃了",
			Mode:         "reference",
			Category:     "level2-hopelessness",
			Language:     "zh",
			CrisisLevels: "[2]",
			DisplayOrder: 25,
			Content:      "[Listen] I hear that you've reached a point where giving up feels like the only option.\n[Empathize] You've been fighting for so long. It's okay to be tired.\n[Confirm] What were you hoping would be different?",
			ContentZh:    "【倾听】我听到你已经到了一个放弃感觉是唯一选择的地步。\n【共情】你已经战斗了这么久。累了是可以的。\n【确认】你希望什么会不一样？",
			IsActive:     true,
		},
		// English Level 2 scripts
		{
			Title:        "Feeling hopeless",
			TitleZh:      "感到绝望",
			Mode:         "reference",
			Category:     "level2-hopelessness",
			Language:     "en",
			CrisisLevels: "[2]",
			DisplayOrder: 26,
			Content:      "[Listen] I hear that everything feels hopeless right now.\n[Empathize] When we can't see light at the end of the tunnel, each step feels impossible.\n[Confirm] What would need to change for things to feel less hopeless?",
			ContentZh:    "【倾听】我听到现在一切都感觉没有希望。\n【共情】当我们看不到隧道尽头的光时，每一步都感觉不可能。\n【确认】需要什么改变才能让事情感觉不那么绝望？",
			IsActive:     true,
		},
		{
			Title:        "Nobody understands me",
			TitleZh:      "没人理解我",
			Mode:         "reference",
			Category:     "level2-isolation",
			Language:     "en",
			CrisisLevels: "[2]",
			DisplayOrder: 27,
			Content:      "[Listen] Feeling misunderstood can be so isolating. I want to understand.\n[Empathize] It takes energy to keep trying to explain yourself when it feels pointless.\n[Confirm] What do you wish people knew about what you're going through?",
			ContentZh:    "【倾听】感觉不被理解可能非常孤立。我想理解。\n【共情】当感觉毫无意义时，不断试图解释自己需要消耗精力。\n【确认】你希望人们知道你正在经历什么？",
			IsActive:     true,
		},
		{
			Title:        "Life feels meaningless",
			TitleZh:      "生活感觉没有意义",
			Mode:         "reference",
			Category:     "level2-hopelessness",
			Language:     "en",
			CrisisLevels: "[2]",
			DisplayOrder: 28,
			Content:      "[Listen] I hear that life feels empty and without purpose right now.\n[Empathize] When nothing seems to matter, it's hard to find motivation for anything.\n[Confirm] Was there something that used to bring you meaning? What happened?",
			ContentZh:    "【倾听】我听到生活现在感觉空虚没有目的。\n【共情】当似乎什么都不重要时，很难为任何事情找到动力。\n【确认】有没有什么曾经给你带来意义？发生了什么？",
			IsActive:     true,
		},
		{
			Title:        "I can't keep going",
			TitleZh:      "我无法继续下去",
			Mode:         "reference",
			Category:     "level2-hopelessness",
			Language:     "en",
			CrisisLevels: "[2]",
			DisplayOrder: 29,
			Content:      "[Listen] I hear that you've reached your limit.\n[Empathize] You've been carrying so much. It's okay to feel depleted.\n[Confirm] What would taking a break look like for you right now?",
			ContentZh:    "【倾听】我听到你已经到了极限。\n【共情】你一直承载着这么多。感到疲惫是可以的。\n【确认】休息一下对你来说现在是什么样子？",
			IsActive:     true,
		},
		{
			Title:        "I'm so alone",
			TitleZh:      "我太孤独了",
			Mode:         "reference",
			Category:     "level2-isolation",
			Language:     "en",
			CrisisLevels: "[2]",
			DisplayOrder: 30,
			Content:      "[Listen] Loneliness is such a heavy weight to carry.\n[Empathize] Being alone and feeling alone are both painful in their own ways.\n[Confirm] What kind of connection are you missing most right now?",
			ContentZh:    "【倾听】孤独是如此沉重的负担。\n【共情】独自一人和感到孤独都以各自的方式令人痛苦。\n【确认】你现在最想念什么样的连接？",
			IsActive:     true,
		},

		// ============ Level 1: Stress/Negative emotions (Low Risk) ============
		// Chinese Level 1 scripts
		{
			Title:        "压力很大",
			TitleZh:      "压力很大",
			Mode:         "reference",
			Category:     "level1-stress",
			Language:     "zh",
			CrisisLevels: "[1]",
			DisplayOrder: 40,
			Content:      "[Listen] I hear that you're under a lot of pressure right now.\n[Empathize] Feeling overwhelmed is exhausting, both mentally and physically.\n[Confirm] What's weighing on you the most?",
			ContentZh:    "【倾听】我听到你现在压力很大。\n【共情】感到不堪重负是令人疲惫的，无论是精神上还是身体上。\n【确认】什么最让你感到沉重？",
			IsActive:     true,
		},
		{
			Title:        "心情不好",
			TitleZh:      "心情不好",
			Mode:         "reference",
			Category:     "level1-mood",
			Language:     "zh",
			CrisisLevels: "[1]",
			DisplayOrder: 41,
			Content:      "[Listen] I can hear that you're not feeling great today.\n[Empathize] Sometimes our mood just dips, and that's okay.\n[Confirm] What happened? Or is it just one of those days?",
			ContentZh:    "【倾听】我能感觉到你今天心情不太好。\n【共情】有时候我们的心情就是会低落，这是正常的。\n【确认】发生了什么？还是只是那种日子之一？",
			IsActive:     true,
		},
		{
			Title:        "焦虑不安",
			TitleZh:      "焦虑不安",
			Mode:         "reference",
			Category:     "level1-anxiety",
			Language:     "zh",
			CrisisLevels: "[1]",
			DisplayOrder: 42,
			Content:      "[Listen] I hear that you're feeling anxious. That uncomfortable buzz in your chest.\n[Empathize] Anxiety can make everything feel more difficult than it needs to be.\n[Confirm] What's your anxiety focused on right now?",
			ContentZh:    "【倾听】我听到你感到焦虑。胸口那种不舒服的嗡嗡声。\n【共情】焦虑可以让一切都感觉比需要的更困难。\n【确认】你的焦虑现在集中在什么上？",
			IsActive:     true,
		},
		{
			Title:        "学习/工作太累了",
			TitleZh:      "学习/工作太累了",
			Mode:         "reference",
			Category:     "level1-exhaustion",
			Language:     "zh",
			CrisisLevels: "[1]",
			DisplayOrder: 43,
			Content:      "[Listen] I hear that school/work is really wearing you down.\n[Empathize] The constant demands can really drain our energy.\n[Confirm] Is there one thing that's been especially hard lately?",
			ContentZh:    "【倾听】我听到学习/工作真的让你很累。\n【共情】持续的要求真的会消耗我们的能量。\n【确认】最近有什么特别难的事情吗？",
			IsActive:     true,
		},
		{
			Title:        "烦躁易怒",
			TitleZh:      "烦躁易怒",
			Mode:         "reference",
			Category:     "level1-irritable",
			Language:     "zh",
			CrisisLevels: "[1]",
			DisplayOrder: 44,
			Content:      "[Listen] I can feel that you're frustrated and on edge.\n[Empathize] When we're running low on patience, everything feels more irritating.\n[Confirm] What's been getting under your skin?",
			ContentZh:    "【倾听】我能感觉到你很沮丧和紧张。\n【共情】当我们耐心不足时，一切都感觉更烦人。\n【确认】什么一直让你不舒服？",
			IsActive:     true,
		},
		// English Level 1 scripts
		{
			Title:        "Feeling stressed",
			TitleZh:      "感到压力",
			Mode:         "reference",
			Category:     "level1-stress",
			Language:     "en",
			CrisisLevels: "[1]",
			DisplayOrder: 45,
			Content:      "[Listen] I hear that you're dealing with a lot of stress.\n[Empathize] When everything piles up, it can feel like there's no room to breathe.\n[Confirm] What's taking up the most space in your mind right now?",
			ContentZh:    "【倾听】我听到你正在处理很多压力。\n【共情】当一切都堆积起来时，可能感觉没有喘息的空间。\n【确认】现在什么占据了你大部分的心思？",
			IsActive:     true,
		},
		{
			Title:        "Bad mood",
			TitleZh:      "心情不好",
			Mode:         "reference",
			Category:     "level1-mood",
			Language:     "en",
			CrisisLevels: "[1]",
			DisplayOrder: 46,
			Content:      "[Listen] I can tell today isn't a great day for you.\n[Empathize] We all have days where things just feel off.\n[Confirm] Is there something specific bothering you, or just a general heaviness?",
			ContentZh:    "【倾听】我能看出今天对你来说不是很好的一天。\n【共情】我们都有感觉不对劲的日子。\n【确认】有什么具体的事情困扰你，还是只是一种普遍的沉重感？",
			IsActive:     true,
		},
		{
			Title:        "Anxious",
			TitleZh:      "焦虑",
			Mode:         "reference",
			Category:     "level1-anxiety",
			Language:     "en",
			CrisisLevels: "[1]",
			DisplayOrder: 47,
			Content:      "[Listen] I hear that anxiety is making things hard right now.\n[Empathize] That constant worry can be so exhausting to carry around.\n[Confirm] What thoughts keep coming back? What are you worried about?",
			ContentZh:    "【倾听】我听到焦虑现在让事情变得很难。\n【共情】持续的担忧可能非常令人疲惫。\n【确认】什么想法一直回来？你在担心什么？",
			IsActive:     true,
		},
		{
			Title:        "Overwhelmed by work/school",
			TitleZh:      "被工作/学习压垮",
			Mode:         "reference",
			Category:     "level1-exhaustion",
			Language:     "en",
			CrisisLevels: "[1]",
			DisplayOrder: 48,
			Content:      "[Listen] I hear that work/school is really taking a toll on you.\n[Empathize] The pressure to keep performing can feel relentless.\n[Confirm] What would help lighten the load even a little bit?",
			ContentZh:    "【倾听】我听到工作/学习真的在影响你。\n【共情】保持表现的压力可能感觉无情。\n【确认】什么能帮助减轻负担，哪怕一点点？",
			IsActive:     true,
		},

		// ============ Special Scenarios ============
		{
			Title:        "User declines resources",
			TitleZh:      "用户拒绝资源",
			Mode:         "reference",
			Category:     "special-decline",
			Language:     "en",
			CrisisLevels: "[]",
			DisplayOrder: 60,
			Content:      "[Listen] I hear that you're not ready to call anyone right now, and that's okay.\n[Empathize] Taking that step can feel really big, and there's no pressure.\n[Confirm] I'm still here with you. Would you like to keep talking?",
			ContentZh:    "【倾听】我听到你现在还没准备好打电话给任何人，这是可以的。\n【共情】迈出那一步可能感觉真的很大，没有压力。\n【确认】我还在这里陪着你。你想继续聊吗？",
			IsActive:     true,
		},
		{
			Title:        "用户拒绝资源",
			TitleZh:      "用户拒绝资源",
			Mode:         "reference",
			Category:     "special-decline",
			Language:     "zh",
			CrisisLevels: "[]",
			DisplayOrder: 61,
			Content:      "[Listen] I hear that you don't want to call a hotline right now.\n[Empathize] That's completely your choice, and I respect it.\n[Confirm] I'm not going anywhere. What would feel helpful right now?",
			ContentZh:    "【倾听】我听到你现在不想打热线电话。\n【共情】这完全是你的选择，我尊重它。\n【确认】我不会离开。现在什么会让你感觉有帮助？",
			IsActive:     true,
		},
		{
			Title:        "User says thank you",
			TitleZh:      "用户说谢谢",
			Mode:         "reference",
			Category:     "special-thanks",
			Language:     "en",
			CrisisLevels: "[]",
			DisplayOrder: 62,
			Content:      "Thank you for trusting me with this. You're doing something brave by talking about your feelings. I'm here whenever you need me.",
			ContentZh:    "谢谢你信任我告诉我这些。谈论你的感受是勇敢的。我随时都在。",
			IsActive:     true,
		},
		{
			Title:        "用户说谢谢",
			TitleZh:      "用户说谢谢",
			Mode:         "reference",
			Category:     "special-thanks",
			Language:     "zh",
			CrisisLevels: "[]",
			DisplayOrder: 63,
			Content:      "Thank you for sharing this with me. Taking time to process your feelings is important. I'm always here.",
			ContentZh:    "谢谢你和我分享这些。花时间处理你的感受很重要。我一直都在。",
			IsActive:     true,
		},
		{
			Title:        "User shows improvement",
			TitleZh:      "用户表现出改善",
			Mode:         "reference",
			Category:     "special-improvement",
			Language:     "en",
			CrisisLevels: "[]",
			DisplayOrder: 64,
			Content:      "I'm glad to hear things are feeling a bit lighter. Remember, it's okay if there are ups and downs. You're doing great by taking care of yourself.",
			ContentZh:    "很高兴听到事情感觉轻松一点了。记住，有起有伏是正常的。照顾好自己，你做得很好。",
			IsActive:     true,
		},
		{
			Title:        "用户表现出改善",
			TitleZh:      "用户表现出改善",
			Mode:         "reference",
			Category:     "special-improvement",
			Language:     "zh",
			CrisisLevels: "[]",
			DisplayOrder: 65,
			Content:      "That's a positive step. It's okay to have setbacks too - healing isn't linear. I'm proud of you for taking care of yourself.",
			ContentZh:    "这是积极的一步。有倒退也是可以的——康复不是线性的。我为你照顾好自己感到骄傲。",
			IsActive:     true,
		},
		{
			Title:        "User is angry or frustrated",
			TitleZh:      "用户愤怒或沮丧",
			Mode:         "reference",
			Category:     "special-anger",
			Language:     "en",
			CrisisLevels: "[]",
			DisplayOrder: 66,
			Content:      "[Listen] I can feel the frustration coming through. It sounds like you're really angry.\n[Empathize] Anger is often a sign that something important to us has been hurt or crossed.\n[Confirm] What happened? What's making you feel this way?",
			ContentZh:    "【倾听】我能感受到挫败感。听起来你真的很生气。\n【共情】愤怒通常是我们重视的东西被伤害或越界的信号。\n【确认】发生了什么？是什么让你有这种感觉？",
			IsActive:     true,
		},
		{
			Title:        "用户愤怒或沮丧",
			TitleZh:      "用户愤怒或沮丧",
			Mode:         "reference",
			Category:     "special-anger",
			Language:     "zh",
			CrisisLevels: "[]",
			DisplayOrder: 67,
			Content:      "[Listen] I hear that you're really frustrated right now.\n[Empathize] It's okay to be angry. Your feelings are valid.\n[Confirm] Can you tell me what's going on?",
			ContentZh:    "【倾听】我听到你现在真的很沮丧。\n【共情】生气是可以的。你的感受是有效的。\n【确认】你能告诉我发生了什么吗？",
			IsActive:     true,
		},
	}

	db.Create(&scripts)
	return len(scripts)
}
