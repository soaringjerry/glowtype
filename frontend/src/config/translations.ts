// Bilingual translations for the app
export type Lang = 'en' | 'zh';

export const TRANSLATIONS = {
  en: {
    nav: { safety: "Safety", learn: "Glowpedia", lang: "中文" },
    hero: { tag: "For youth 16+ • Free • Anonymous", titlePre: "What's your", titleHighlight: "Glowtype?", subtitle: "A playful emotional mirror. Not a diagnosis, just a lighter way to understand your inner universe.", btnStart: "Start the Quiz", btnSafe: "Is this safe? How it works" },
    quiz: { question: "Question", questionSuffix: "", total: "Total", back: "Back" },
    result: { label: "Your Glowtype", insightBtn: "Reveal Cosmic Insight", insightLoading: "Decoding Signal...", note: "Note: This is not a medical diagnosis. It's a tool for self-reflection.", btnChat: "Chat about this (AI)", btnHelp: "Find professional help", shareTitle: "Share your Glow", shareDesc: "Save this card or share link", promptContext: "Answer in English." },
    chat: { header: "Anonymous Chat", end: "End Chat", disclaimer: "Private • No Data Saved • Powered by Gemini", intro: "Hi there. I'm Glowtype AI. I'm here to listen gently. I'm not a human, but I care about what you have to say.", placeholder: "Type here...", crisisResponse: "I hear that you are in pain, but I am just an AI. Please, for your safety, use the red Crisis Help button below to talk to a real person who can help." },
    safety: { back: "Back", title: "Is it safe?", card1Title: "Privacy First", card1Desc: "We do not ask for your real name, phone number, or email. Your answers are processed in your browser session.", card2Title: "Anonymous AI Chat", card2Desc: "The chat is powered by AI (Gemini). It does not judge. Chat logs are transient. Please do not share personal info.", card3Title: "Crisis Support", card3Desc: "Glowtype is NOT a replacement for professional therapy. If you are in danger, please use the red button below." },
    learn: { title: "Glowpedia", subtitle: "Your pocket guide to emotional wellness", back: "Home", draw: "Draw a Glow Stick", redraw: "Draw Again", keep: "Got It", pickPlanet: "What do you need right now?", changePlanet: "Change Topic", sectionTitle: "Glow Sticks" },
    crisis: { title: "Here for you", subtitle: "Whatever you're going through, help is available.", back: "Close", sectionCall: "Immediate Help (24/7)", sectionText: "Text & Counseling" },
    footer: { label: "Need someone to talk to?", btn: "Support is here" }
  },
  zh: {
    nav: { safety: "安全说明", learn: "光芒百科", lang: "English" },
    hero: { tag: "面向 16+ 青年 • 免费 • 匿名", titlePre: "测测你的", titleHighlight: "光芒人格?", subtitle: "一面有趣的情绪镜子。不是医疗诊断，而是一种探索内心宇宙的轻松方式。", btnStart: "开始测试", btnSafe: "安全吗？如何运作" },
    quiz: { question: "第", questionSuffix: "题", total: "共", back: "返回上一题" },
    result: { label: "你的光芒类型", insightBtn: "揭示宇宙洞察", insightLoading: "正在连接星辰...", note: "注意：这不是医疗诊断。这只是一个自我探索的工具。", btnChat: "聊聊这个 (AI 陪伴)", btnHelp: "寻找专业帮助", shareTitle: "分享你的光芒", shareDesc: "保存卡片或复制链接", promptContext: "请用温暖、治愈的中文回答，像个知心朋友。" },
    chat: { header: "匿名树洞", end: "结束对话", disclaimer: "隐私保护 • 不保存数据 • Gemini AI 驱动", intro: "你好呀。我是 Glowtype AI。我会在这里静静倾听。虽然我不是人类，但我很在乎你想说的话。", placeholder: "在这里输入...", crisisResponse: "我听到了你的痛苦，但我只是一个 AI。为了你的安全，请立刻点击下方的红色「获取危机援助」按钮，寻找真人的帮助。" },
    safety: { back: "返回", title: "这安全吗？", card1Title: "隐私优先", card1Desc: "我们不需要你的真名、电话或邮箱。你的测试答案仅在浏览器中处理，不会建立个人档案。", card2Title: "匿名 AI 聊天", card2Desc: "聊天由 AI (Gemini) 驱动。它不会评判你。聊天记录是暂时的，结束后即销毁。请勿分享个人隐私。", card3Title: "危机支持", card3Desc: "Glowtype 不能替代专业治疗。如果你处于危险中，请务必使用屏幕底部的红色按钮求助。" },
    learn: { title: "光芒百科", subtitle: "你的情绪健康口袋指南", back: "返回首页", draw: "抽一支光签", redraw: "再抽一签", keep: "收下了", pickPlanet: "你现在需要什么？", changePlanet: "换个主题", sectionTitle: "光签" },
    crisis: { title: "我们在这里", subtitle: "无论你在经历什么，都有人愿意倾听。", back: "关闭", sectionCall: "立即通话 (24/7)", sectionText: "文字 & 辅导支持" },
    footer: { label: "想要找人聊聊？", btn: "温暖支持" }
  }
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;
