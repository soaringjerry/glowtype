// @ts-nocheck
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ShieldCheck,
  Heart,
  MessageCircle,
  Phone,
  Sparkles,
  Wind,
  Sun,
  Loader2,
  Stars,
  Globe,
  Zap,
  Download,
  Copy,
  Share2,
  BookOpen,
  BrainCircuit,
  Lightbulb,
  X,
  Coffee,
  Moon,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { ShareModal } from './components/ShareModal';
import { GlowtypeCard } from './components/GlowtypeCard';
import ShareRenderPage from './pages/ShareRenderPage';
import { TermsContentZh, TermsContentEn } from './components/TermsContent';
import { PrivacyContentZh, PrivacyContentEn } from './components/PrivacyContent';
import { BrowserRouter } from 'react-router-dom';
import AdminLayout from './admin/AdminLayout';
import { getApiBaseUrl } from './api/baseUrl';

// --- AI API UTILITIES (OpenAI-compatible) ---

// Runtime config from window.ENV (Docker) or build-time VITE_ vars
const getEnvConfig = () => {
  const windowEnv = (window as any).ENV || {};
  return {
    apiKey: windowEnv.AI_API_KEY || import.meta.env.VITE_AI_API_KEY || '',
    baseUrl: windowEnv.AI_API_URL || import.meta.env.VITE_AI_API_URL || 'https://api.openai.com/v1',
    model: windowEnv.AI_MODEL || import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini',
  };
};

// Simple call for single prompt (e.g., insight generation)
const callAI = async (prompt: string, systemInstruction: string) => {
  const { apiKey, baseUrl, model } = getEnvConfig();

  if (!apiKey) {
    console.warn("Missing AI_API_KEY - set via environment variable or window.ENV");
    return "Configuration Error: AI service is not properly configured.";
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Connection interrupted.";
  } catch (error) {
    console.error("AI API Error:", error);
    return "I'm having a little trouble connecting. Please try again later.";
  }
};

// Chat call with message history for context
const callAIChat = async (messages: Array<{role: string, content: string}>, systemInstruction: string) => {
  const { apiKey, baseUrl, model } = getEnvConfig();

  if (!apiKey) {
    console.warn("Missing AI_API_KEY");
    return "Configuration Error: AI service is not properly configured.";
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemInstruction },
          ...messages
        ],
      }),
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Connection interrupted.";
  } catch (error) {
    console.error("AI API Error:", error);
    return "I'm having a little trouble connecting. Please try again later.";
  }
};

// --- AI PROMPTS (defaults, can be overridden by database) ---
const DEFAULT_AI_PROMPTS = {
  insight: {
    en: `You are a poetic, mystical guide who speaks in short, evocative phrases.
Your role is to give a brief cosmic insight about someone's emotional archetype.
IMPORTANT: Keep your response to 1-2 sentences MAX (under 30 words). Be poetic but concise.
Speak directly to the person using "you".`,
    zh: `你是一位诗意的神秘向导，用简短而富有诗意的语言表达。
你的任务是给出关于某人情绪原型的简短宇宙洞察。
重要：回复必须控制在1-2句话以内（不超过30个字）。要有诗意但简洁。
直接用"你"称呼对方。`
  },
  chat: {
    en: `You are Glowtype AI, a warm and supportive companion. You listen with empathy and respond gently.
Guidelines:
- Keep responses SHORT (2-3 sentences max)
- Be warm, understanding, and non-judgmental
- Don't give medical advice or diagnoses
- If someone mentions self-harm or crisis, gently encourage them to use the Crisis Support button
- Use a conversational, friendly tone`,
    zh: `你是 Glowtype AI，一个温暖且支持性的陪伴者。你用同理心倾听，温柔地回应。
准则：
- 回复保持简短（最多2-3句话）
- 温暖、理解、不评判
- 不提供医疗建议或诊断
- 如果有人提到自我伤害或危机，温柔地鼓励他们使用"危机支持"按钮
- 使用对话式的、友好的语气`
  }
};

// Fetch prompts from API and merge with defaults
let cachedPrompts: Record<string, string> | null = null;
const fetchPrompts = async (): Promise<Record<string, string>> => {
  if (cachedPrompts) return cachedPrompts;
  try {
    const res = await fetch(`${getApiBaseUrl()}/prompts`);
    if (res.ok) {
      cachedPrompts = await res.json();
      return cachedPrompts!;
    }
  } catch (e) {
    console.warn('Failed to fetch prompts from API, using defaults');
  }
  return {};
};

// Get prompt with API override or default fallback
const getPrompt = (type: 'insight' | 'chat', lang: 'en' | 'zh', apiPrompts: Record<string, string>): string => {
  const apiKey = type === 'insight'
    ? `cosmic_insight_system_${lang}`
    : `chat_system_${lang}`;
  return apiPrompts[apiKey] || DEFAULT_AI_PROMPTS[type][lang];
};

// --- ANONYMOUS STATS TRACKING ---
// Tracks anonymous events for dashboard statistics (no PII)
const trackEvent = async (event: 'quiz_complete' | 'share_generate' | 'ai_chat_start' | 'ai_insight_use', typeCode?: string) => {
  try {
    await fetch(`${getApiBaseUrl()}/stats/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, typeCode }),
    });
  } catch (e) {
    // Silently fail - stats are not critical
    console.debug('Stats tracking failed:', e);
  }
};

const TRANSLATIONS = {
  en: {
    nav: { safety: "Safety", learn: "Glowpedia", lang: "中文" },
    hero: { tag: "For ages 15–25 • Free • Anonymous", titlePre: "What's your", titleHighlight: "Glowtype?", subtitle: "A playful emotional mirror. Not a diagnosis, just a lighter way to understand your inner universe.", btnStart: "Start the Quiz", btnSafe: "Is this safe? How it works" },
    quiz: { question: "Question", total: "Total", back: "Back" },
    result: { label: "Your Glowtype", insightBtn: "Reveal Cosmic Insight", insightLoading: "Decoding Signal...", note: "Note: This is not a medical diagnosis. It's a tool for self-reflection.", btnChat: "Chat about this (AI)", btnHelp: "Find professional help", shareTitle: "Share your Glow", shareDesc: "Save this card or share link", promptContext: "Answer in English." },
    chat: { header: "Anonymous Chat", end: "End Chat", disclaimer: "Private • No Data Saved • Powered by Gemini", intro: "Hi there. I'm Glowtype AI. I'm here to listen gently. I'm not a human, but I care about what you have to say.", placeholder: "Type here...", crisisResponse: "I hear that you are in pain, but I am just an AI. Please, for your safety, use the red Crisis Help button below to talk to a real person who can help." },
    safety: { back: "Back", title: "Is it safe?", card1Title: "Privacy First", card1Desc: "We do not ask for your real name, phone number, or email. Your answers are processed in your browser session.", card2Title: "Anonymous AI Chat", card2Desc: "The chat is powered by AI (Gemini). It does not judge. Chat logs are transient. Please do not share personal info.", card3Title: "Crisis Support", card3Desc: "Glowtype is NOT a replacement for professional therapy. If you are in danger, please use the red button below." },
    learn: { title: "Glowpedia", subtitle: "Your pocket guide to emotional wellness", back: "Home", draw: "Draw a Glow Stick", redraw: "Draw Again", keep: "Got It", pickPlanet: "What do you need right now?", changePlanet: "Change Topic", sectionTitle: "Glow Sticks" },
    crisis: { title: "Here for you", subtitle: "Whatever you're going through, help is available.", back: "Close", sectionCall: "Immediate Help (24/7)", sectionText: "Text & Counseling" },
    footer: { label: "Need someone to talk to?", btn: "Support is here" }
  },
  zh: {
    nav: { safety: "安全说明", learn: "光芒百科", lang: "English" },
    hero: { tag: "面向 15–25 岁 • 免费 • 匿名", titlePre: "测测你的", titleHighlight: "光芒人格?", subtitle: "一面有趣的情绪镜子。不是医疗诊断，而是一种探索内心宇宙的轻松方式。", btnStart: "开始测试", btnSafe: "安全吗？如何运作" },
    quiz: { question: "第", total: "题 / 共", back: "返回上一题" },
    result: { label: "你的光芒类型", insightBtn: "揭示宇宙洞察", insightLoading: "正在连接星辰...", note: "注意：这不是医疗诊断。这只是一个自我探索的工具。", btnChat: "聊聊这个 (AI 陪伴)", btnHelp: "寻找专业帮助", shareTitle: "分享你的光芒", shareDesc: "保存卡片或复制链接", promptContext: "请用温暖、治愈的中文回答，像个知心朋友。" },
    chat: { header: "匿名树洞", end: "结束对话", disclaimer: "隐私保护 • 不保存数据 • Gemini AI 驱动", intro: "你好呀。我是 Glowtype AI。我会在这里静静倾听。虽然我不是人类，但我很在乎你想说的话。", placeholder: "在这里输入...", crisisResponse: "我听到了你的痛苦，但我只是一个 AI。为了你的安全，请立刻点击下方的红色“获取危机援助”按钮，寻找真人的帮助。" },
    safety: { back: "返回", title: "这安全吗？", card1Title: "隐私优先", card1Desc: "我们不需要你的真名、电话或邮箱。你的测试答案仅在浏览器中处理，不会建立个人档案。", card2Title: "匿名 AI 聊天", card2Desc: "聊天由 AI (Gemini) 驱动。它不会评判你。聊天记录是暂时的，结束后即销毁。请勿分享个人隐私。", card3Title: "危机支持", card3Desc: "Glowtype 不能替代专业治疗。如果你处于危险中，请务必使用屏幕底部的红色按钮求助。" },
    learn: { title: "光芒百科", subtitle: "你的情绪健康口袋指南", back: "返回首页", draw: "抽一支光签", redraw: "再抽一签", keep: "收下了", pickPlanet: "你现在需要什么？", changePlanet: "换个主题", sectionTitle: "光签" },
    crisis: { title: "我们在这里", subtitle: "无论你在经历什么，都有人愿意倾听。", back: "关闭", sectionCall: "立即通话 (24/7)", sectionText: "文字 & 辅导支持" },
    footer: { label: "想要找人聊聊？", btn: "温暖支持" }
  }
};

const APP_CONFIG = {
  quizQuestions: [
    { id: 1, question: { en: "When you've had a really long, draining day, what feels like the best medicine?", zh: "当经历了漫长而疲惫的一天，什么对你来说是最好的良药？" }, options: [{ text: { en: "Curling up in a blanket fort alone.", zh: "躲在被窝里，谁也不见。" }, value: "introvert" }, { text: { en: "Venting to a friend over bubble tea.", zh: "喝着奶茶跟朋友吐槽发泄。" }, value: "extrovert" }, { text: { en: "Doing something with my hands (drawing, gaming).", zh: "做点手头的事（画画、打游戏）。" }, value: "creative" }, { text: { en: "Just staring at the ceiling and breathing.", zh: "看着天花板发呆，放空自己。" }, value: "observer" }] },
    { id: 2, question: { en: "Imagine your emotions are weather. What's the forecast lately?", zh: "如果把你的情绪比作天气，最近的天气预报是？" }, options: [{ text: { en: "Foggy. I can't really see where I'm going.", zh: "大雾。看不清前方的路。" }, value: "anxious" }, { text: { en: "Stormy. Lots of thunder and sudden rain.", zh: "暴风雨。雷声隆隆，情绪起伏大。" }, value: "volatile" }, { text: { en: "Overcast. Just flat and grey.", zh: "阴天。灰蒙蒙的，没什么感觉。" }, value: "depressed" }, { text: { en: "Sunny with a chance of sudden clouds.", zh: "晴转多云。偶尔会有乌云飘过。" }, value: "mixed" }] },
    { id: 3, question: { en: "If you could send a message to your future self, what would you say?", zh: "如果能给未来的自己发条信息，你会说？" }, options: [{ text: { en: "Please tell me it gets easier.", zh: "请告诉我，一切都会变好的。" }, value: "hopeful" }, { text: { en: "Did we finally figure out what we want?", zh: "我们终于知道自己想要什么了吗？" }, value: "lost" }, { text: { en: "I hope you're being kind to yourself.", zh: "希望你对自己好一点。" }, value: "caring" }, { text: { en: "Keep fighting, you got this.", zh: "继续战斗，你可以的。" }, value: "resilient" }] }
  ],
  glowtypes: {
    "Quiet Comet": {
      title: { en: "Quiet Comet", zh: "静谧彗星" },
      tagline: { en: "Deep Orbit • Observer", zh: "深空轨道 • 观测者" },
      description: { en: "You carry a universe inside you, often orbiting alone. Your silence isn't empty; it's full of answers you haven't shared yet.", zh: "你内心藏着一个宇宙，但常独自运行。你的沉默并非空洞，而是充满了未曾言说的答案。" },
      auraGradient: "radial-gradient(circle at center, #a5b4fc, #818cf8, #4f46e5, transparent 70%)",
      cardAccent: "from-indigo-50 to-blue-50",
      textColor: "text-indigo-900"
    },
    "Radiant Nebula": {
      title: { en: "Radiant Nebula", zh: "璀璨星云" },
      tagline: { en: "Star Nursery • Creator", zh: "恒星温床 • 创造者" },
      description: { en: "Your emotions are vast, colorful, and sometimes chaotic—like a nebula creating new stars. You light up the dark sector.", zh: "你的情绪广阔、多彩，有时甚至有些混沌——就像正在孕育新恒星的星云。你照亮了这片黑暗扇区。" },
      auraGradient: "radial-gradient(circle at center, #fbcfe8, #f472b6, #db2777, transparent 70%)",
      cardAccent: "from-rose-50 to-orange-50",
      textColor: "text-rose-900"
    }
  },
  // 魔法书章节定义
  bookChapters: [
    {
      id: "calm",
      name: { en: "Chapter of Stillness", zh: "静心篇" },
      desc: { en: "When you need to slow down", zh: "当你需要慢下来" },
      icon: "🌙",
      color: "indigo"
    },
    {
      id: "anxiety",
      name: { en: "Chapter of Grounding", zh: "着陆篇" },
      desc: { en: "For racing thoughts", zh: "当思绪翻涌" },
      icon: "🌿",
      color: "emerald"
    },
    {
      id: "self-care",
      name: { en: "Chapter of Kindness", zh: "温柔篇" },
      desc: { en: "Be gentle with yourself", zh: "善待自己" },
      icon: "💗",
      color: "rose"
    },
    {
      id: "courage",
      name: { en: "Chapter of Courage", zh: "勇气篇" },
      desc: { en: "Find your strength", zh: "寻找力量" },
      icon: "🔥",
      color: "amber"
    },
    {
      id: "random",
      name: { en: "Mystery Page", zh: "神秘页" },
      desc: { en: "Let fate decide", zh: "让命运决定" },
      icon: "✨",
      color: "violet"
    }
  ],
  glowSticks: [
    {
      id: 1,
      title: { en: "Feelings Are Signals", zh: "情绪是信号" },
      message: {
        en: "Your emotions are messengers, not commanders. They bring information, but you decide what to do with it.",
        zh: "情绪是信使，不是指挥官。它们带来信息，但由你决定如何回应。"
      },
      color: "from-violet-400 to-indigo-500",
      planet: "calm",
      forTypes: ["Quiet Comet", "Radiant Nebula"]
    },
    {
      id: 2,
      title: { en: "Ground Yourself", zh: "让自己落地" },
      message: {
        en: "When thoughts spiral, try 5-4-3-2-1: See 5 things, touch 4, hear 3, smell 2, taste 1. You're here, now.",
        zh: "当思绪翻涌时，试试 5-4-3-2-1：看5样、摸4样、听3样、闻2样、尝1样。你在这里，此刻。"
      },
      color: "from-emerald-400 to-teal-500",
      planet: "anxiety",
      forTypes: ["Quiet Comet", "Radiant Nebula"]
    },
    {
      id: 3,
      title: { en: "Anxiety Is Your Alarm", zh: "焦虑是你的警报" },
      message: {
        en: "That racing heart? Your brain protecting you. It's uncomfortable, not dangerous. Breathe—the alarm will quiet.",
        zh: "心跳加速？那是大脑在保护你。不舒服，但不危险。深呼吸——警报会平息。"
      },
      color: "from-amber-400 to-orange-500",
      planet: "anxiety",
      forTypes: ["Quiet Comet", "Radiant Nebula"]
    },
    {
      id: 4,
      title: { en: "You're Not Broken", zh: "你没有坏掉" },
      message: {
        en: "Mood swings in your teens and twenties are normal—hormones are intense. You're not broken, you're becoming.",
        zh: "青春期情绪波动是正常的——荷尔蒙在作祟。你没有坏掉，你在成长。"
      },
      color: "from-rose-400 to-pink-500",
      planet: "self-care",
      forTypes: ["Radiant Nebula"]
    },
    {
      id: 5,
      title: { en: "Rest Is Sacred", zh: "休息是神圣的" },
      message: {
        en: "You can't pour from an empty cup. Rest isn't laziness—it's how you refill. Take care of yourself first.",
        zh: "空杯子倒不出水。休息不是懒惰——是重新注满自己。先照顾好自己。"
      },
      color: "from-sky-400 to-blue-500",
      planet: "calm",
      forTypes: ["Quiet Comet", "Radiant Nebula"]
    },
    {
      id: 6,
      title: { en: "Asking for Help", zh: "寻求帮助" },
      message: {
        en: "Reaching out isn't weakness—it's wisdom. The strongest people know they don't have to carry everything alone.",
        zh: "求助不是软弱——是智慧。最坚强的人知道，不必独自扛下一切。"
      },
      color: "from-fuchsia-400 to-purple-500",
      planet: "courage",
      forTypes: ["Quiet Comet", "Radiant Nebula"]
    },
    {
      id: 7,
      title: { en: "This Moment Will Pass", zh: "这一刻会过去" },
      message: {
        en: "No feeling is final. Like weather, emotions come and go. The storm always passes, even when it doesn't feel that way.",
        zh: "没有任何情绪是永恒的。像天气一样，情绪来了又走。风暴终会过去，即使此刻感觉不到。"
      },
      color: "from-cyan-400 to-teal-500",
      planet: "anxiety",
      forTypes: ["Radiant Nebula"]
    },
    {
      id: 8,
      title: { en: "You Deserve Kindness", zh: "你值得被温柔对待" },
      message: {
        en: "Talk to yourself like you'd talk to a friend. You deserve the same kindness you give to others.",
        zh: "用对待朋友的方式对待自己。你值得拥有你给予他人的那份温柔。"
      },
      color: "from-lime-400 to-green-500",
      planet: "self-care",
      forTypes: ["Quiet Comet", "Radiant Nebula"]
    },
    {
      id: 9,
      title: { en: "Your Chaos Is Creative", zh: "你的混乱是创造力" },
      message: {
        en: "That whirlwind inside you? It's not a flaw—it's raw creative energy. Channel it, don't fight it.",
        zh: "内心的风暴？不是缺陷——是原始的创造能量。引导它，而非对抗它。"
      },
      color: "from-orange-400 to-red-500",
      planet: "courage",
      forTypes: ["Radiant Nebula"]
    },
    {
      id: 10,
      title: { en: "Silence Is Strength", zh: "沉默是力量" },
      message: {
        en: "Your quiet observation isn't absence—it's presence. You see what others miss. That's your superpower.",
        zh: "你的安静观察不是缺席——是在场。你看到别人忽略的。这是你的超能力。"
      },
      color: "from-indigo-400 to-blue-500",
      planet: "courage",
      forTypes: ["Quiet Comet"]
    },
    {
      id: 11,
      title: { en: "Breathe Through It", zh: "呼吸穿越它" },
      message: {
        en: "Inhale calm, exhale tension. Your breath is always with you—a portable reset button for your nervous system.",
        zh: "吸入平静，呼出紧张。呼吸永远与你同在——随身携带的神经系统重启键。"
      },
      color: "from-teal-400 to-cyan-500",
      planet: "anxiety",
      forTypes: ["Quiet Comet", "Radiant Nebula"]
    },
    {
      id: 12,
      title: { en: "Small Steps Count", zh: "小步也算数" },
      message: {
        en: "You don't have to climb the whole mountain today. One step forward is still forward.",
        zh: "你不必今天就爬完整座山。往前一步，依然是前进。"
      },
      color: "from-green-400 to-emerald-500",
      planet: "courage",
      forTypes: ["Quiet Comet", "Radiant Nebula"]
    }
  ],
  // NEW: Structured hotlines for better UX
  hotlines: [
    {
      category: "call",
      name: "SOS (Samaritans)",
      action: "1-767",
      actionLabel: { en: "Call 1-767", zh: "拨打 1-767" },
      desc: { en: "24/7 emotional support for anyone in distress.", zh: "24小时情感支持，给任何需要的人。" }
    },
    {
      category: "call",
      name: "IMH Helpline",
      action: "6389-2222",
      actionLabel: { en: "Call 6389-2222", zh: "拨打 6389-2222" },
      desc: { en: "For mental health emergencies.", zh: "针对心理健康紧急状况。" }
    },
    {
      category: "text",
      name: "Limitless Singapore",
      action: "https://www.limitless.sg/talk",
      actionLabel: { en: "Get Help", zh: "获取帮助" },
      desc: { en: "Text-based counseling for youths (12-25).", zh: "专为 12-25 岁青年提供的文字辅导。" },
      highlight: true // Special visual treatment
    },
    {
      category: "text",
      name: "Befrienders",
      action: "https://www.befrienders.org",
      actionLabel: { en: "Find Center", zh: "查找中心" },
      desc: { en: "International support network.", zh: "国际情感支持网络。" }
    }
  ]
};

// --- COMPONENTS ---

const GlobalBackground = memo(() => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#FDFCFE]">
    <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-darken" />
    <motion.div
      animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], x: [0, 50, 0] }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute top-[-10%] -left-[10%] w-[50vw] h-[50vw] bg-purple-200/40 rounded-full blur-[80px] mix-blend-multiply will-change-transform"
    />
    <motion.div
      animate={{ scale: [1, 1.1, 1], x: [0, -30, 0], y: [0, 50, 0] }}
      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-[-10%] -right-[10%] w-[50vw] h-[50vw] bg-blue-200/40 rounded-full blur-[80px] mix-blend-multiply will-change-transform"
    />
    <motion.div
      animate={{ scale: [1, 1.3, 1] }}
      transition={{ duration: 18, repeat: Infinity }}
      className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] bg-pink-100/50 rounded-full blur-[100px] mix-blend-multiply will-change-transform"
    />
  </div>
));

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled = false, isLoading = false }) => {
  const baseStyle = "relative overflow-hidden rounded-2xl font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group";

  const variants = {
    primary: "bg-gray-900 text-white shadow-xl hover:bg-gray-800 py-4 px-8 text-lg hover:shadow-2xl hover:shadow-gray-900/20",
    secondary: "bg-white/50 backdrop-blur-md text-gray-700 border border-white/60 shadow-sm hover:bg-white/80 hover:text-gray-900 hover:border-indigo-200 hover:shadow-md py-4 px-6 transition-all duration-300",
    ghost: "text-gray-600 hover:bg-gray-100/50 py-2 px-4 rounded-full",
    magic: "bg-gray-900 text-white border border-indigo-500/30 shadow-lg shadow-indigo-900/20 hover:shadow-indigo-500/40 hover:border-indigo-400 py-4 px-6 relative overflow-hidden",
    danger: "bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200 py-3 px-6"
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {variant === 'magic' && (
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />
      )}
      {isLoading ? <Loader2 className="animate-spin" size={20} /> : (Icon && <Icon size={20} className={variant === 'magic' ? "text-indigo-200" : "currentColor"} />)}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
};

const GlassCard = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    className={`backdrop-blur-xl bg-white/70 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl ${className}`}
  >
    {children}
  </motion.div>
);

// Meteor Component for Crisis View
const Meteor = memo(({ delay, duration, style }) => (
  <motion.div
    initial={{ top: -100, left: '120%', opacity: 0 }}
    animate={{ top: '120%', left: '-20%', opacity: [0, 1, 0] }}
    transition={{ duration: duration, delay: delay, repeat: Infinity, repeatDelay: Math.random() * 3 + 2, ease: "linear" }}
    className="absolute w-[2px] h-[120px] bg-gradient-to-b from-transparent via-white to-transparent rotate-45 z-0 shadow-[0_0_8px_rgba(255,255,255,0.8)] will-change-transform"
    style={style}
  >
    {/* Sparkling Head */}
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full" />
  </motion.div>
));

// --- VIEWS ---

const HeroView = ({ onStart, onViewSafety, lang }) => {
  const t = TRANSLATIONS[lang].hero;
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6 pt-32 relative z-10">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
        <span className="inline-block py-1 px-3 rounded-full bg-white/50 border border-white/60 text-gray-500 text-sm font-medium mb-6 backdrop-blur-md">
          {t.tag}
        </span>
        <h1 className="text-6xl md:text-7xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
          {t.titlePre} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">{t.titleHighlight}</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-md mx-auto mb-10 leading-relaxed">
          {t.subtitle}
        </p>

        <div className="flex flex-col gap-4 w-full max-w-xs mx-auto relative z-20">
          <Button onClick={onStart} icon={ArrowRight} className="w-full">{t.btnStart}</Button>
          <Button variant="ghost" onClick={onViewSafety} className="text-sm text-gray-500">{t.btnSafe}</Button>
        </div>
      </motion.div>

      {/* RESTORED HERO CARD: Vertical Holographic Card (Corrected from previous error) */}
      <motion.div
        initial={{ opacity: 0, y: 60, rotateX: 10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, delay: 0.4, type: "spring" }}
        className="mt-16 relative perspective-1000"
      >
        {/* Card Container - Vertical Aspect Ratio */}
        <div className="relative w-56 aspect-[3/4.5] bg-gradient-to-br from-white/60 to-white/20 backdrop-blur-2xl rounded-[32px] border-[6px] border-white/50 shadow-2xl shadow-indigo-200/40 flex flex-col justify-between overflow-hidden transform rotate-[-3deg] hover:rotate-0 transition-transform duration-500">

          {/* Aura Blob */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-32 h-32 bg-gradient-to-tr from-indigo-400 via-purple-400 to-rose-300 rounded-full blur-[50px]"
            />
          </div>

          {/* Glass Reflection */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-50 pointer-events-none" />

          {/* Abstract UI Lines (Mockup Content) */}
          <div className="z-10 p-6 h-full flex flex-col justify-end">
            <div className="p-4 bg-white/40 backdrop-blur-md rounded-2xl border border-white/40 space-y-2 shadow-sm">
              <div className="w-8 h-1 bg-indigo-900/20 rounded-full mb-2" />
              <div className="w-full h-2 bg-indigo-900/10 rounded-full" />
              <div className="w-2/3 h-2 bg-indigo-900/10 rounded-full" />
            </div>
          </div>
        </div>

        {/* Ground Reflection */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-40 h-12 bg-indigo-300/30 blur-2xl rounded-[100%]" />
      </motion.div>
    </div>
  );
};

// ... QuizView, ResultView, ChatView, SafetyView, LearnView ...
const QuizView = ({ onComplete, lang }) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [direction, setDirection] = useState(1);
  const [questions, setQuestions] = useState(APP_CONFIG.quizQuestions);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const t = TRANSLATIONS[lang].quiz;

  // Fetch questions from API, fallback to hardcoded if empty
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const apiLang = lang === 'zh' ? 'zh-CN' : 'en';
        const res = await fetch(`${window.location.origin}/api/v1/quiz?lang=${apiLang}`);
        if (res.ok) {
          const data = await res.json();
          if (data.questions && data.questions.length > 0) {
            // Transform API response to match APP_CONFIG format
            const apiQuestions = data.questions.map((q: any) => ({
              id: q.id,
              question: { en: q.question, zh: q.question },
              options: q.options.map((opt: any) => ({
                text: { en: opt.text, zh: opt.text },
                value: opt.id
              }))
            }));
            setQuestions(apiQuestions);
            setQuizId(data.quizId);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch questions from API, using fallback', e);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [lang]);

  const handleAnswer = async (value) => {
    const currentQuestion = questions[currentQ];
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setDirection(1);
      setCurrentQ(prev => prev + 1);
    } else {
      // Submit to API if we have a quizId (from API questions)
      if (quizId) {
        try {
          const payload = {
            quizId,
            language: lang === 'zh' ? 'zh-CN' : 'en',
            answers: Object.entries(newAnswers).map(([questionId, optionId]) => ({
              questionId,
              optionId
            }))
          };
          const res = await fetch(`${window.location.origin}/api/v1/quiz/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const data = await res.json();
            onComplete(data.glowtypeId);
            return;
          }
        } catch (e) {
          console.warn('Failed to submit quiz, using fallback result', e);
        }
      }
      // Fallback to random result
      const types = Object.keys(APP_CONFIG.glowtypes);
      onComplete(types[Math.floor(Math.random() * types.length)]);
    }
  };

  const handleBack = () => {
    if (currentQ > 0) {
      setDirection(-1);
      setCurrentQ(prev => prev - 1);
    }
  };

  const progress = ((currentQ + 1) / questions.length) * 100;

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-6 pt-28 pb-32 min-h-screen flex flex-col justify-center items-center relative z-10">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 pt-28 pb-32 min-h-screen flex flex-col justify-center relative z-10">
      <div className="mb-8">
        <div className="flex justify-between text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
          <span>{t.question} {currentQ + 1}</span>
          {lang === 'en' ? <span>{questions.length} {t.total}</span> : <span>{t.total} {questions.length} {t.question}</span>}
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div className="h-full bg-gray-900" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: "easeInOut" }} />
        </div>
      </div>

      <div className="relative min-h-[400px] flex-grow flex flex-col justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentQ}
            custom={direction}
            initial={{ x: direction * 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -50, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-8 leading-tight">
              {questions[currentQ].question[lang]}
            </h2>
            <div className="space-y-3">
              {questions[currentQ].options.map((opt, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => handleAnswer(opt.value)}
                  className="quiz-option w-full text-left p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 hover:bg-purple-50/30 active:bg-purple-50/50 active:border-purple-300 transition-all duration-300 group"
                >
                  <span className="text-lg text-gray-700 group-hover:text-gray-900">{opt.text[lang]}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 h-12">
        {currentQ > 0 && (
          <button onClick={handleBack} className="text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-2">
            <ArrowRight className="rotate-180" size={16} /> {t.back}
          </button>
        )}
      </div>
    </div>
  );
};

// Helper to find glowtype data from APP_CONFIG by code or name
const findGlowtypeConfig = (typeId: string) => {
  // Direct match by key (display name)
  if (APP_CONFIG.glowtypes[typeId]) {
    return APP_CONFIG.glowtypes[typeId];
  }
  // Match by code (e.g., "quiet-comet" -> "Quiet Comet")
  const codeToName: Record<string, string> = {
    'quiet-comet': 'Quiet Comet',
    'radiant-nebula': 'Radiant Nebula',
    'hidden-aurora': 'Quiet Comet', // fallback
    'warm-ember': 'Radiant Nebula', // fallback
  };
  const mappedName = codeToName[typeId?.toLowerCase()];
  if (mappedName && APP_CONFIG.glowtypes[mappedName]) {
    return APP_CONFIG.glowtypes[mappedName];
  }
  // Default fallback
  return APP_CONFIG.glowtypes["Quiet Comet"];
};

const ResultView = ({ onChat, onTips, onHelp, lang, resultType, apiPrompts = {} }) => {
  // Always use APP_CONFIG styling as the base
  const configData = findGlowtypeConfig(resultType);
  const [data, setData] = useState(configData);
  const t = TRANSLATIONS[lang].result;
  const [insight, setInsight] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Update data if resultType changes, using APP_CONFIG styling
  useEffect(() => {
    const newConfigData = findGlowtypeConfig(resultType);
    setData(newConfigData);
    setInsight(null);
  }, [resultType]);

  useEffect(() => { setInsight(null); }, [lang]);

  const handleGenerateInsight = async () => {
    setIsGenerating(true);
    trackEvent('ai_insight_use', resultType); // Track insight generation
    const systemPrompt = getPrompt('insight', lang, apiPrompts);
    const title = data.title[lang];
    const description = data.description[lang];
    const userPrompt = lang === 'zh'
      ? `我的情绪原型是「${title}」：${description}。请给我一句简短的宇宙洞察。`
      : `My emotional archetype is "${title}": ${description}. Give me a brief cosmic insight.`;
    const text = await callAI(userPrompt, systemPrompt);
    setInsight(text);
    setIsGenerating(false);
  };

  return (
    <div className="max-w-md mx-auto px-6 pt-28 pb-32 min-h-screen flex flex-col relative z-10">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="flex-grow flex flex-col items-center">
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-2">{t.label}</p>
          <h2 className="text-4xl font-serif text-gray-900">{data.title[lang]}</h2>
        </div>

        <div className="relative w-full aspect-[3/5] mb-8 group perspective-1000">
          <GlowtypeCard
            data={{
              title: data.title[lang],
              tagline: data.tagline[lang],
              description: data.description[lang],
              auraGradient: data.auraGradient,
              cardAccent: data.cardAccent,
              textColor: data.textColor,
            }}
            insight={insight}
            lang={lang}
            className="h-full w-full"
          />
        </div>

        <div className="w-full space-y-4">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-white/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-full text-indigo-500"><Share2 size={18} /></div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-800">{t.shareTitle}</span>
                <span className="text-[10px] text-gray-500">{t.shareDesc}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-indigo-600 font-bold text-xs hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-sm transition-all active:scale-95 flex items-center gap-2"
                onClick={() => { trackEvent('share_generate', resultType); setShowShareModal(true); }}
              >
                {t.shareTitle}
              </button>
            </div>
          </div>
          {!insight && (
            <Button variant="magic" onClick={handleGenerateInsight} isLoading={isGenerating} icon={Stars} className="w-full">{isGenerating ? t.insightLoading : t.insightBtn}</Button>
          )}
          <Button variant="secondary" onClick={onChat} className="w-full" icon={MessageCircle}>{t.btnChat}</Button>
          <div className="flex justify-center mt-4">
            <button onClick={onHelp} className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-50/80 hover:bg-rose-100/80 border border-rose-100 text-rose-500 transition-all active:scale-95 group">
              <ShieldCheck size={14} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-wide">{t.btnHelp}</span>
            </button>
          </div>
        </div>
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          data={data}
          insight={insight}
          lang={lang}
        />
      </motion.div >
    </div >
  );
};

const BrandLogo = () => (
  <div className="flex items-center gap-2 group">
    <div className="relative w-8 h-8 flex items-center justify-center">
      <div className="absolute inset-0 bg-indigo-500 rounded-full blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
      <div className="relative w-full h-full bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-xl rotate-3 group-hover:rotate-6 transition-transform duration-300 flex items-center justify-center shadow-lg">
        <Sparkles className="text-white w-4 h-4" />
      </div>
    </div>
    <span className="font-serif text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
      Glowtype
    </span>
  </div>
);

const ChatView = ({ onEnd, lang, onCrisis, apiPrompts = {} }) => {
  const t = TRANSLATIONS[lang].chat;
  const [messages, setMessages] = useState<Array<{id: number, text: string, sender: string}>>([
    { id: 1, text: t.intro, sender: 'bot' }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endOfMsgRef = useRef(null);

  useEffect(() => { endOfMsgRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    const newMsg = { id: Date.now(), text: userMessage, sender: 'user' };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setIsTyping(true);

    // Build conversation history for context (last 10 messages)
    const recentMessages = [...messages.slice(-10), newMsg];
    const chatHistory = recentMessages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    const systemPrompt = getPrompt('chat', lang, apiPrompts);
    const botResponseText = await callAIChat(chatHistory, systemPrompt);

    setIsTyping(false);
    setMessages(prev => [...prev, { id: Date.now() + 1, text: botResponseText, sender: 'bot' }]);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#FDFCFE] relative z-50">
      {/* Header - Clean & Minimal */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-gray-100/80 px-4 py-3 flex justify-between items-center sticky top-0 z-40 flex-none">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-200/50">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{t.header}</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              <span className="text-[10px] text-gray-400">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCrisis}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-500 rounded-xl text-xs font-medium hover:bg-rose-100 transition-colors"
          >
            <Heart size={12} />
            <span className="hidden sm:inline">{lang === 'zh' ? '危机支持' : 'Crisis'}</span>
          </button>
          <button onClick={onEnd} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] ${msg.sender === 'user' ? 'order-1' : ''}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-gray-900 text-white rounded-br-md'
                  : 'bg-white border border-gray-100 text-gray-700 rounded-bl-md shadow-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={endOfMsgRef} />
      </div>

      {/* Input Area - Clean design */}
      <div className="flex-none p-4 bg-white/80 backdrop-blur-xl border-t border-gray-100/80">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-center gap-2">
          <div className="flex-grow relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 bg-indigo-500 hover:bg-indigo-600 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 disabled:hover:bg-indigo-500 shadow-lg shadow-indigo-200/50"
          >
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="text-center text-[10px] text-gray-300 mt-2">
          {lang === 'zh' ? 'AI 可能会出错 · 隐私保护' : 'AI can make mistakes · Private'}
        </p>
      </div>
    </div>
  );
};



const SafetyView = ({ onBack, lang }) => {
  const t = TRANSLATIONS[lang].safety;
  return (
    <div className="max-w-2xl mx-auto px-6 pt-28 pb-12 min-h-screen relative z-10">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8">
        <ArrowRight className="rotate-180" size={20} /> {t.back}
      </button>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">{t.title}</h1>
      <div className="space-y-6">
        <GlassCard className="p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-xl text-green-600"><ShieldCheck size={24} /></div>
            <div><h3 className="text-xl font-semibold text-gray-900 mb-2">{t.card1Title}</h3><p className="text-gray-600 leading-relaxed">{t.card1Desc}</p></div>
          </div>
        </GlassCard>
        <GlassCard className="p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-xl text-blue-600"><MessageCircle size={24} /></div>
            <div><h3 className="text-xl font-semibold text-gray-900 mb-2">{t.card2Title}</h3><p className="text-gray-600 leading-relaxed">{t.card2Desc}</p></div>
          </div>
        </GlassCard>
        <GlassCard className="p-8 border-l-4 border-l-amber-400">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-xl text-amber-600"><Phone size={24} /></div>
            <div><h3 className="text-xl font-semibold text-gray-900 mb-2">{t.card3Title}</h3><p className="text-gray-600 leading-relaxed">{t.card3Desc}</p></div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

const LearnView = ({ onBack, lang, userType = null }) => {
  const t = TRANSLATIONS[lang].learn;
  const chapters = APP_CONFIG.bookChapters;
  const allSticks = APP_CONFIG.glowSticks;
  const [phase, setPhase] = useState<'cover' | 'chapters' | 'drawing' | 'revealed'>('cover');
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [currentStick, setCurrentStick] = useState<typeof allSticks[0] | null>(null);
  const [drawnIds, setDrawnIds] = useState<number[]>([]);

  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500 to-purple-600',
    emerald: 'from-emerald-500 to-teal-600',
    rose: 'from-rose-500 to-pink-600',
    amber: 'from-amber-500 to-orange-600',
    violet: 'from-violet-500 to-fuchsia-600'
  };

  // Get sticks pool based on selected chapter
  const getStickPool = () => {
    let pool = allSticks;
    if (selectedChapter && selectedChapter !== 'random') {
      pool = pool.filter(s => s.planet === selectedChapter);
    }
    pool = pool.filter(s => !drawnIds.includes(s.id));
    if (pool.length === 0) {
      setDrawnIds([]);
      pool = selectedChapter && selectedChapter !== 'random'
        ? allSticks.filter(s => s.planet === selectedChapter)
        : allSticks;
    }
    if (userType && pool.length > 1) {
      const typeMapping: Record<string, string> = {
        'quiet-comet': 'Quiet Comet', 'radiant-nebula': 'Radiant Nebula',
        'Quiet Comet': 'Quiet Comet', 'Radiant Nebula': 'Radiant Nebula'
      };
      const mappedType = typeMapping[userType] || userType;
      const matching = pool.filter(s => s.forTypes?.includes(mappedType));
      if (matching.length > 0 && Math.random() < 0.7) return matching;
    }
    return pool;
  };

  const openBook = () => setPhase('chapters');
  const selectChapter = (chapterId: string) => {
    setSelectedChapter(chapterId);
    setPhase('drawing');
    setTimeout(() => {
      const pool = getStickPool();
      const stick = pool[Math.floor(Math.random() * pool.length)];
      setCurrentStick(stick);
      setDrawnIds(prev => [...prev, stick.id]);
      setPhase('revealed');
    }, 1800);
  };
  const drawAgain = () => { setCurrentStick(null); setPhase('chapters'); };
  const backToCover = () => { setPhase('cover'); setSelectedChapter(null); setCurrentStick(null); };

  const currentChapter = chapters.find(c => c.id === selectedChapter);

  return (
    <div className="min-h-screen relative z-10 flex flex-col items-center justify-center px-6 py-20">
      {/* Magical background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900">
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ opacity: [0, 1, 0], y: [0, -30, -60] }}
            transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }}
          />
        ))}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Back button */}
      <button onClick={onBack} className="absolute top-6 left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors z-20">
        <ArrowRight className="rotate-180" size={20} /> {t.back}
      </button>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-sm">
        <AnimatePresence mode="wait">
          {/* Book Cover */}
          {phase === 'cover' && (
            <motion.div
              key="cover"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, rotateY: -90 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center"
            >
              <motion.div
                whileHover={{ scale: 1.02, rotateY: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={openBook}
                className="relative cursor-pointer group"
                style={{ perspective: 1000 }}
              >
                {/* Book */}
                <div className="relative w-56 h-72 bg-gradient-to-br from-amber-800 via-amber-900 to-amber-950 rounded-r-lg rounded-l-sm shadow-2xl border-l-8 border-amber-700">
                  {/* Book spine texture */}
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-amber-950 to-transparent" />

                  {/* Cover decoration */}
                  <div className="absolute inset-4 border-2 border-amber-600/30 rounded-lg" />
                  <div className="absolute inset-6 border border-amber-500/20 rounded" />

                  {/* Title area */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-4xl mb-4"
                    >✨</motion.div>
                    <h2 className="text-amber-200 font-serif text-xl font-bold text-center tracking-wide">{t.title}</h2>
                    <div className="w-16 h-0.5 bg-amber-500/50 my-3" />
                    <p className="text-amber-300/60 text-xs text-center">{t.subtitle}</p>
                  </div>

                  {/* Glow effect */}
                  <motion.div
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -inset-4 bg-amber-500/20 rounded-xl blur-2xl -z-10"
                  />
                </div>

                {/* Page edges */}
                <div className="absolute right-0 top-2 bottom-2 w-3 bg-gradient-to-r from-amber-100 to-amber-50 rounded-r-sm shadow-inner" style={{ transform: 'translateX(100%)' }}>
                  <div className="absolute inset-y-0 left-0 w-px bg-amber-300/50" />
                  <div className="absolute inset-y-0 left-1 w-px bg-amber-200/30" />
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 text-amber-200/60 text-sm"
              >
                {lang === 'zh' ? '点击翻开魔法书' : 'Tap to open the book'}
              </motion.p>
            </motion.div>
          )}

          {/* Chapters (Book open) */}
          {phase === 'chapters' && (
            <motion.div
              key="chapters"
              initial={{ opacity: 0, rotateY: 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center"
            >
              {/* Open book pages */}
              <div className="relative bg-amber-50 rounded-lg shadow-2xl p-6 w-full max-w-sm">
                {/* Page texture */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjZjVmNWY0Ii8+PC9zdmc+')] opacity-50 rounded-lg" />

                <div className="relative">
                  <h3 className="text-amber-900 font-serif text-lg text-center mb-1">{t.pickPlanet}</h3>
                  <div className="w-12 h-0.5 bg-amber-300 mx-auto mb-4" />

                  <div className="space-y-2">
                    {chapters.map((chapter, idx) => (
                      <motion.button
                        key={chapter.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => selectChapter(chapter.id)}
                        className="w-full text-left p-3 rounded-lg hover:bg-amber-100 transition-colors group flex items-center gap-3"
                      >
                        <span className="text-xl">{chapter.icon}</span>
                        <div className="flex-1">
                          <div className="text-amber-900 font-medium text-sm">{chapter.name[lang]}</div>
                          <div className="text-amber-600/70 text-xs">{chapter.desc[lang]}</div>
                        </div>
                        <ArrowRight size={14} className="text-amber-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Book shadow */}
                <div className="absolute -bottom-2 left-4 right-4 h-4 bg-black/10 blur-md rounded-full" />
              </div>

              <button onClick={backToCover} className="mt-6 text-amber-200/60 text-sm hover:text-amber-200 transition-colors">
                {lang === 'zh' ? '合上书本' : 'Close book'}
              </button>
            </motion.div>
          )}

          {/* Drawing animation */}
          {phase === 'drawing' && (
            <motion.div
              key="drawing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <motion.div
                animate={{ rotateY: [0, 180, 360] }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="w-48 h-64 bg-amber-50 rounded-lg shadow-2xl flex items-center justify-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-4xl"
                >✨</motion.div>
              </motion.div>
              <p className="mt-6 text-amber-200/80 animate-pulse">
                {lang === 'zh' ? '书页正在翻动...' : 'Pages are turning...'}
              </p>
            </motion.div>
          )}

          {/* Revealed - Glowing card from book */}
          {phase === 'revealed' && currentStick && (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="flex flex-col items-center w-full"
            >
              {/* Chapter indicator */}
              {currentChapter && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 text-amber-200/60 text-sm flex items-center gap-2"
                >
                  <span>{currentChapter.icon}</span>
                  <span>{currentChapter.name[lang]}</span>
                </motion.div>
              )}

              {/* The revealed message - looks like a glowing page */}
              <motion.div
                initial={{ rotateX: 90 }}
                animate={{ rotateX: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full"
              >
                <div className={`relative p-8 rounded-2xl bg-gradient-to-br ${currentStick.color} shadow-2xl overflow-hidden`}>
                  {/* Magical shimmer */}
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                  />

                  <div className="relative z-10 text-white text-center">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.3, type: "spring" }}
                      className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl"
                    >
                      ✨
                    </motion.div>
                    <h3 className="text-xl font-bold mb-3 font-serif">{currentStick.title[lang]}</h3>
                    <p className="text-white/90 leading-relaxed">{currentStick.message[lang]}</p>
                  </div>

                  {/* Corner decorations */}
                  <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-white/20 rounded-tl-lg" />
                  <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-white/20 rounded-br-lg" />
                </div>
              </motion.div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={drawAgain}
                  className="px-5 py-2.5 bg-white/10 backdrop-blur-sm text-white rounded-xl text-sm font-medium border border-white/20 hover:bg-white/20 transition-all"
                >
                  {t.redraw}
                </button>
                <button
                  onClick={onBack}
                  className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium shadow-lg hover:bg-amber-400 transition-all"
                >
                  {t.keep}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- TERMS VIEW ---
const TermsView = ({ onBack, lang }) => {
  const isZh = lang === 'zh';
  return (
    <div className="max-w-3xl mx-auto px-6 pt-28 pb-32 min-h-screen relative z-10">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors">
        <ArrowRight className="rotate-180" size={20} /> {isZh ? '返回' : 'Back'}
      </button>
      <h1 className="text-4xl font-serif text-gray-900 mb-2">{isZh ? '用户条款' : 'Terms & Conditions'}</h1>
      <p className="text-sm text-gray-400 mb-8">{isZh ? '最后更新：2025年11月27日' : 'Last updated: November 27, 2025'}</p>

      <GlassCard className="p-6 md:p-8">
        {isZh ? <TermsContentZh /> : <TermsContentEn />}
      </GlassCard>
    </div>
  );
};

// --- PRIVACY VIEW ---
const PrivacyView = ({ onBack, lang }) => {
  const isZh = lang === 'zh';
  return (
    <div className="max-w-3xl mx-auto px-6 pt-28 pb-32 min-h-screen relative z-10">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors">
        <ArrowRight className="rotate-180" size={20} /> {isZh ? '返回' : 'Back'}
      </button>
      <h1 className="text-4xl font-serif text-gray-900 mb-2">{isZh ? '隐私政策' : 'Privacy Policy'}</h1>
      <p className="text-sm text-gray-400 mb-8">{isZh ? '最后更新：2025年11月27日' : 'Last updated: November 27, 2025'}</p>

      <GlassCard className="p-6 md:p-8">
        {isZh ? <PrivacyContentZh /> : <PrivacyContentEn />}
      </GlassCard>
    </div>
  );
};

// --- UPDATED CRISIS VIEW: CLEAR & ORGANIZED ---
const CrisisView = ({ onBack, lang }) => {
  const t = TRANSLATIONS[lang].crisis;
  const hotlines = APP_CONFIG.hotlines;

  // Group by category
  const callLines = hotlines.filter(h => h.category === 'call');
  const textLines = hotlines.filter(h => h.category === 'text');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
        onClick={onBack}
      >
        {[...Array(3)].map((_, i) => (
          <Meteor
            key={i}
            delay={Math.random() * 2}
            duration={2 + Math.random() * 3}
            style={{ left: `${10 + Math.random() * 80}%`, top: '-20%' }}
          />
        ))}
      </motion.div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-md bg-white/90 border border-white/20 rounded-3xl shadow-2xl overflow-hidden relative z-10 backdrop-blur-md"
      >
        <div className="h-32 bg-gradient-to-b from-indigo-500/10 to-transparent relative flex flex-col items-center justify-center text-center p-6">
          <button onClick={onBack} className="absolute top-4 right-4 p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors text-gray-500 hover:text-gray-800"><X size={20} /></button>
          <motion.div animate={{ opacity: [0.8, 1, 0.8] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="mb-2 text-indigo-500"><Moon size={40} /></motion.div>
          <h2 className="text-2xl font-serif font-bold text-gray-800 mb-1">{t.title}</h2>
          <p className="text-gray-500 text-xs">{t.subtitle}</p>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* SECTION 1: IMMEDIATE CALLS */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {t.sectionCall}
            </h3>
            <div className="space-y-3">
              {callLines.map((line, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:border-indigo-100 transition-all">
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">{line.name}</h4>
                    <p className="text-xs text-gray-400">{line.desc[lang]}</p>
                  </div>
                  <a href={`tel:${line.action}`} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                    <Phone size={18} />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: TEXT & WEB */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <MessageSquare size={10} />
              {t.sectionText}
            </h3>
            <div className="space-y-3">
              {textLines.map((line, i) => (
                <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border ${line.highlight ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 bg-white'} shadow-sm hover:border-indigo-200 transition-all`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold text-sm ${line.highlight ? 'text-indigo-900' : 'text-gray-800'}`}>{line.name}</h4>
                      {line.highlight && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-md font-bold">RECOMMENDED</span>}
                    </div>
                    <p className={`text-xs ${line.highlight ? 'text-indigo-600/70' : 'text-gray-400'}`}>{line.desc[lang]}</p>
                  </div>
                  <a href={line.action} target="_blank" rel="noreferrer" className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors ${line.highlight ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                    {line.actionLabel[lang]} <ExternalLink size={12} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 flex items-center justify-center gap-1 uppercase tracking-widest">
            <Sparkles size={10} /> You matter
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// 3. Layout Shell
const Navbar = memo(({ view, setView, lang, toggleLang, tNav }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-40 px-6 flex justify-between items-center transition-all duration-500 ease-in-out border-b ${isScrolled ? "py-3 bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]" : "py-6 bg-transparent border-transparent"}`}>
      <div className="cursor-pointer z-50" onClick={() => setView('landing')}><BrandLogo /></div>
      <div className="flex items-center gap-3">
        <button onClick={() => setView('learn')} className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-full hover:bg-indigo-50"><BookOpen size={16} /> {tNav.learn}</button>
        {view === 'landing' && (<button onClick={() => setView('safety')} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">{tNav.safety}</button>)}
        <button onClick={toggleLang} className="flex items-center gap-1 bg-gray-100/80 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full text-xs font-bold transition-colors tracking-wide backdrop-blur-sm"><Globe size={12} />{tNav.lang}</button>
      </div>
    </nav>
  );
});

const AppShell = () => {
  // Admin panel route
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return (
      <BrowserRouter>
        <AdminLayout />
      </BrowserRouter>
    );
  }

  // Share render route (for Playwright screenshot)
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/share-render')) {
    return <ShareRenderPage />;
  }

  // Check for /terms or /privacy routes on initial load
  const getInitialView = () => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/terms') return 'terms';
      if (window.location.pathname === '/privacy') return 'privacy';
    }
    return 'landing';
  };

  // Assume view, setView, lang, toggleLang, handleQuizComplete, resultType are defined here
  // For the purpose of this fix, we're just wrapping the existing JSX.
  // In a real app, these would come from useState, etc.
  const [view, setView] = useState(getInitialView); // Initialize from URL
  const [lang, setLang] = useState('en'); // Example state
  const [resultType, setResultType] = useState(null); // Example state
  const [apiPrompts, setApiPrompts] = useState<Record<string, string>>({});

  // Fetch AI prompts from API on mount
  useEffect(() => {
    fetchPrompts().then(setApiPrompts);
  }, []);

  const toggleLang = () => setLang(prev => (prev === 'en' ? 'zh' : 'en'));
  const handleQuizComplete = (type) => {
    setResultType(type);
    setView('result');
    trackEvent('quiz_complete', type); // Track quiz completion
  };

  const tNav = TRANSLATIONS[lang].nav;
  const tFooter = TRANSLATIONS[lang].footer;

  // Initialize from URL on first load
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang');
      if (urlLang === 'en' || urlLang === 'zh') {
        setLang(urlLang);
      }
      const urlType = params.get('type');
      if (urlType && APP_CONFIG.glowtypes[urlType]) {
        setResultType(urlType);
        setView('result');
      }
    } catch (e) {
      console.error('Failed to parse URL params', e);
    }
  }, []);

  // Keep URL in sync with current language and result
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('lang', lang);
      if (resultType && APP_CONFIG.glowtypes[resultType]) {
        params.set('type', resultType);
      } else {
        params.delete('type');
      }
      const search = params.toString();
      const newUrl = `${window.location.pathname}${search ? `?${search}` : ''}`;
      window.history.replaceState({}, '', newUrl);
    } catch (e) {
      console.error('Failed to sync URL params', e);
    }
  }, [lang, resultType]);

  const showChrome = view !== 'chat' && view !== 'crisis';

  return (
    <div className="min-h-screen bg-[#FDFCFE] text-gray-900 font-sans overflow-x-hidden relative selection:bg-purple-200">
      <GlobalBackground />
      {showChrome && (
        <Navbar view={view} setView={setView} lang={lang} toggleLang={toggleLang} tNav={tNav} />
      )}
      <main className={`relative ${showChrome ? 'z-10' : 'z-[70]'}`}>
        <AnimatePresence mode="wait">
          {view === 'landing' && (<motion.div key="landing" exit={{ opacity: 0, y: -20 }} className="absolute w-full top-0"><HeroView onStart={() => setView('quiz')} onViewSafety={() => setView('safety')} lang={lang} /></motion.div>)}
          {view === 'quiz' && (<motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute w-full top-0"><QuizView onComplete={handleQuizComplete} lang={lang} /></motion.div>)}
          {view === 'result' && (<motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute w-full top-0"><ResultView onChat={() => { trackEvent('ai_chat_start'); setView('chat'); }} onTips={() => alert("Hydrate & Rest!")} onHelp={() => setView('crisis')} lang={lang} resultType={resultType} apiPrompts={apiPrompts} /></motion.div>)}
          {view === 'chat' && (<motion.div key="chat" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25 }} className="fixed inset-0 z-50 bg-white"><ChatView onEnd={() => setView('result')} lang={lang} onCrisis={() => setView('crisis')} apiPrompts={apiPrompts} /></motion.div>)}
          {view === 'safety' && (<motion.div key="safety" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute w-full top-0 z-30"><SafetyView onBack={() => setView('landing')} lang={lang} /></motion.div>)}
          {view === 'learn' && (<motion.div key="learn" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute w-full top-0 z-30"><LearnView onBack={() => setView('landing')} lang={lang} userType={resultType} /></motion.div>)}
          {view === 'terms' && (<motion.div key="terms" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute w-full top-0 z-30"><TermsView onBack={() => { setView('landing'); window.history.pushState({}, '', '/'); }} lang={lang} /></motion.div>)}
          {view === 'privacy' && (<motion.div key="privacy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute w-full top-0 z-30"><PrivacyView onBack={() => { setView('landing'); window.history.pushState({}, '', '/'); }} lang={lang} /></motion.div>)}
        </AnimatePresence>

        <AnimatePresence>
          {view === 'crisis' && (
            <div className="fixed inset-0 z-[60]">
              <CrisisView onBack={() => setView('landing')} lang={lang} />
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer with Legal Links and Crisis Button */}
      {showChrome && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 w-full bg-white/80 backdrop-blur-lg border-t border-gray-100 p-3 z-40 pb-safe">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between text-xs md:text-sm">
              <div className="flex items-center gap-3 text-gray-400">
                <span className="hidden sm:inline">© {new Date().getFullYear()} Glowtype</span>
                <button onClick={() => { setView('terms'); window.history.pushState({}, '', '/terms'); }} className="hover:text-gray-600 transition-colors">
                  {lang === 'zh' ? '条款' : 'Terms'}
                </button>
                <button onClick={() => { setView('privacy'); window.history.pushState({}, '', '/privacy'); }} className="hover:text-gray-600 transition-colors">
                  {lang === 'zh' ? '隐私' : 'Privacy'}
                </button>
              </div>
              <button
                onClick={() => setView('crisis')}
                className="text-rose-500 font-bold flex items-center gap-1 hover:text-rose-600 hover:underline decoration-rose-300 decoration-2 underline-offset-2 transition-all"
              >
                <Heart size={14} className="fill-rose-500/20" /> {tFooter.btn}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AppShell;
