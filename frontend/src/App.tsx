import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ShieldCheck,
  Heart,
  MessageCircle,
  Phone,
  Sparkles,
  Loader2,
  Stars,
  Globe,
  Share2,
  BookOpen,
  X,
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
import { LearnView } from './views/LearnView';

// Helper to detect if admin is logged in (for test data marking)
const isAdminLoggedIn = (): boolean => {
  try {
    return !!(
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_token')) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('admin_token'))
    );
  } catch {
    return false;
  }
};

const callBackendInsight = async (prompt: string, systemInstruction: string, lang: string) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/chat/insight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemPrompt: systemInstruction, language: lang }),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.reply || "Connection interrupted.";
  } catch (error) {
    console.error("AI API Error:", error);
    return "I'm having a little trouble connecting. Please try again later.";
  }
};

interface ChatSessionOptions {
  language: string;
  glowtypeCode?: string;
  glowtypeId?: string; // Localized name
  dimensionScores?: Record<string, number>;
}

const startChatSession = async (options: ChatSessionOptions) => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: options.language,
        glowtypeCode: options.glowtypeCode,
        glowtypeId: options.glowtypeId,
        dimensionScores: options.dimensionScores,
        isTest: isAdminLoggedIn(),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sessionId as string;
  } catch {
    return null;
  }
};

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

interface CrisisResource {
  name: string;
  phone?: string;
  url?: string;
  region?: string;
}

interface ChatMessageResult {
  reply: string;
  crisisLevel: number;
  resources: CrisisResource[];
}

// Stable ResourceCard component (outside App to prevent re-mount on input change)
const ResourceCard = ({ resources, lang }: { resources: CrisisResource[]; lang: string }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-xl"
  >
    <div className="flex items-center gap-2 mb-2">
      <Heart size={14} className="text-rose-500" />
      <span className="text-xs font-bold text-rose-700">
        {lang === 'zh' ? '支持资源' : 'Support Resources'}
      </span>
    </div>
    <div className="space-y-2">
      {resources.slice(0, 3).map((r, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="text-rose-800 font-medium">{r.name}</span>
          {r.phone && (
            <a href={`tel:${r.phone}`} className="px-2 py-1 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition-colors">
              {r.phone}
            </a>
          )}
          {r.url && !r.phone && (
            <a href={r.url} target="_blank" rel="noreferrer" className="px-2 py-1 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition-colors flex items-center gap-1">
              {lang === 'zh' ? '访问' : 'Visit'} <ExternalLink size={10} />
            </a>
          )}
        </div>
      ))}
    </div>
  </motion.div>
);

const sendChatMessage = async (
  sessionId: string,
  message: string,
  lang: string,
  history?: ChatHistoryItem[]
): Promise<ChatMessageResult> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message,
        language: lang,
        history: history || [],
      }),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();
    return {
      reply: data.reply || '',
      crisisLevel: data.crisisLevel || 0,
      resources: data.resources || [],
    };
  } catch (error) {
    console.error("Chat API Error:", error);
    return {
      reply: lang === 'zh' ? '抱歉，稍后再试。' : "Sorry, please try again later.",
      crisisLevel: 0,
      resources: [],
    };
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
  } catch {
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
const trackEvent = async (event: 'quiz_complete' | 'share_generate' | 'ai_chat_start' | 'ai_insight_use', typeCode?: string | null) => {
  try {
    await fetch(`${getApiBaseUrl()}/stats/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, typeCode: typeCode ?? undefined }),
    });
  } catch (e) {
    // Silently fail - stats are not critical
    console.debug('Stats tracking failed:', e);
  }
};

const TRANSLATIONS = {
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
    chat: { header: "匿名树洞", end: "结束对话", disclaimer: "隐私保护 • 不保存数据 • Gemini AI 驱动", intro: "你好呀。我是 Glowtype AI。我会在这里静静倾听。虽然我不是人类，但我很在乎你想说的话。", placeholder: "在这里输入...", crisisResponse: "我听到了你的痛苦，但我只是一个 AI。为了你的安全，请立刻点击下方的红色“获取危机援助”按钮，寻找真人的帮助。" },
    safety: { back: "返回", title: "这安全吗？", card1Title: "隐私优先", card1Desc: "我们不需要你的真名、电话或邮箱。你的测试答案仅在浏览器中处理，不会建立个人档案。", card2Title: "匿名 AI 聊天", card2Desc: "聊天由 AI (Gemini) 驱动。它不会评判你。聊天记录是暂时的，结束后即销毁。请勿分享个人隐私。", card3Title: "危机支持", card3Desc: "Glowtype 不能替代专业治疗。如果你处于危险中，请务必使用屏幕底部的红色按钮求助。" },
    learn: { title: "光芒百科", subtitle: "你的情绪健康口袋指南", back: "返回首页", draw: "抽一支光签", redraw: "再抽一签", keep: "收下了", pickPlanet: "你现在需要什么？", changePlanet: "换个主题", sectionTitle: "光签" },
    crisis: { title: "我们在这里", subtitle: "无论你在经历什么，都有人愿意倾听。", back: "关闭", sectionCall: "立即通话 (24/7)", sectionText: "文字 & 辅导支持" },
    footer: { label: "想要找人聊聊？", btn: "温暖支持" }
  }
};

// Safety-critical hotlines (intentionally hardcoded for reliability)
const APP_CONFIG = {
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

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'magic' | 'danger';

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  className?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  disabled?: boolean;
  isLoading?: boolean;
}

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled = false, isLoading = false }: ButtonProps) => {
  const baseStyle = "relative overflow-hidden rounded-2xl font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group";

  const variants: Record<ButtonVariant, string> = {
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

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const GlassCard = ({ children, className = '', delay = 0 }: GlassCardProps) => (
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
interface MeteorProps {
  delay: number;
  duration: number;
  repeatDelay: number;
  style?: React.CSSProperties;
}

const Meteor = memo(({ delay, duration, repeatDelay, style }: MeteorProps) => (
  <motion.div
    initial={{ top: -100, left: '120%', opacity: 0 }}
    animate={{ top: '120%', left: '-20%', opacity: [0, 1, 0] }}
    transition={{ duration: duration, delay: delay, repeat: Infinity, repeatDelay: repeatDelay, ease: "linear" }}
    className="absolute w-[2px] h-[120px] bg-gradient-to-b from-transparent via-white to-transparent rotate-45 z-0 shadow-[0_0_8px_rgba(255,255,255,0.8)] will-change-transform"
    style={style}
  >
    {/* Sparkling Head */}
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full" />
  </motion.div>
));

// --- VIEWS ---

interface HeroViewProps {
  onStart: () => void;
  onViewSafety: () => void;
  lang: 'en' | 'zh';
}

const HeroView = ({ onStart, onViewSafety, lang }: HeroViewProps) => {
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
interface QuizViewProps {
  onComplete: (type: string) => void;
  lang: 'en' | 'zh';
}

interface QuizQuestion {
  id: string | number;
  question: { en: string; zh: string };
  options: Array<{ text: { en: string; zh: string }; value: string }>;
}

const QuizView = ({ onComplete, lang }: QuizViewProps) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [direction, setDirection] = useState(1);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = TRANSLATIONS[lang].quiz;

  // Fetch questions from API (single source of truth)
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const apiLang = lang === 'zh' ? 'zh-CN' : 'en';
        const res = await fetch(`${window.location.origin}/api/v1/quiz?lang=${apiLang}`);
        if (!res.ok) {
          throw new Error('Failed to fetch quiz');
        }
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          interface ApiQuestion {
            id: string;
            question: string;
            options: Array<{ id: string; text: string }>;
          }
          const apiQuestions = data.questions.map((q: ApiQuestion) => ({
            id: q.id,
            question: { en: q.question, zh: q.question },
            options: q.options.map((opt) => ({
              text: { en: opt.text, zh: opt.text },
              value: opt.id
            }))
          }));
          setQuestions(apiQuestions);
          setQuizId(data.quizId);
        } else {
          throw new Error('No questions returned');
        }
      } catch (e) {
        console.error('Failed to fetch questions from API', e);
        setFetchError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [lang]);

  const handleAnswer = async (value: string) => {
    const currentQuestion = questions[currentQ];
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setDirection(1);
      setCurrentQ(prev => prev + 1);
    } else {
      // Prevent double submission
      if (isSubmitting) return;
      setIsSubmitting(true);

      // Submit to API for scoring
      try {
        const payload = {
          quizId,
          language: lang === 'zh' ? 'zh-CN' : 'en',
          answers: Object.entries(newAnswers).map(([questionId, optionId]) => ({
            questionId,
            optionId
          })),
          isTest: isAdminLoggedIn()
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
        throw new Error('Failed to score quiz');
      } catch (e) {
        console.error('Failed to submit quiz', e);
        setIsSubmitting(false); // Allow retry on error
        alert(lang === 'zh' ? '提交测试失败，请重试' : 'Failed to submit quiz, please try again');
      }
    }
  };

  const handleBack = () => {
    if (currentQ > 0) {
      setDirection(-1);
      setCurrentQ(prev => prev - 1);
    }
  };

  const progress = questions.length > 0 ? ((currentQ + 1) / questions.length) * 100 : 0;

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-6 pt-28 pb-32 min-h-screen flex flex-col justify-center items-center relative z-10">
        <Loader2 className="animate-spin text-gray-400" size={32} />
        <p className="mt-4 text-gray-500">{lang === 'zh' ? '加载测试题目...' : 'Loading quiz...'}</p>
      </div>
    );
  }

  if (fetchError || questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-6 pt-28 pb-32 min-h-screen flex flex-col justify-center items-center relative z-10">
        <div className="text-center p-6 bg-red-50 border border-red-200 rounded-2xl">
          <p className="text-red-700 font-medium mb-2">
            {lang === 'zh' ? '无法加载测试题目' : 'Failed to load quiz'}
          </p>
          <p className="text-red-600 text-sm mb-4">{fetchError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
          >
            {lang === 'zh' ? '重试' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 pt-28 pb-32 min-h-screen flex flex-col justify-center relative z-10">
      <div className="mb-8">
        <div className="flex justify-between text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
          <span>{t.question} {currentQ + 1}{t.questionSuffix}</span>
          <span>{t.total} {questions.length}{t.questionSuffix}</span>
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

// Glowtype data fetched from API
interface GlowtypeData {
  title: { en: string; zh: string };
  tagline: { en: string; zh: string };
  description: { en: string; zh: string };
  auraGradient: string;
  cardAccent: string;
  textColor: string;
}

// Default styling for loading/error states (no hardcoded content)
const DEFAULT_STYLING = {
  auraGradient: "radial-gradient(circle at center, #e5e7eb, #9ca3af, #6b7280, transparent 70%)",
  cardAccent: "from-gray-50 to-slate-50",
  textColor: "text-gray-900"
};

interface ResultViewProps {
  onChat: () => void;
  onHelp: () => void;
  lang: 'en' | 'zh';
  resultType: string | null;
  apiPrompts?: Record<string, string>;
}

const ResultView = ({ onChat, onHelp, lang, resultType, apiPrompts = {} }: ResultViewProps) => {
  const t = TRANSLATIONS[lang].result;
  const [glowtypeData, setGlowtypeData] = useState<GlowtypeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Track previous resultType and lang to reset insight
  const prevResultType = useRef(resultType);
  const prevLang = useRef(lang);

  // Fetch complete glowtype data from API (single source of truth)
  useEffect(() => {
    if (!resultType) {
      setLoading(false);
      setError('No result type');
      return;
    }

    const fetchGlowtypeData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${getApiBaseUrl()}/glowtypes/${resultType}?lang=${lang}`);
        if (!res.ok) {
          throw new Error(`Glowtype not found: ${resultType}`);
        }
        const json = await res.json();

        // Build GlowtypeData from API response
        // API returns: { id, language, name, tagline, description (array), selfCareTips, disclaimer, auraGradient, cardAccent, textColor }
        const descriptionText = Array.isArray(json.description)
          ? json.description.join(' ')
          : (json.description || '');

        setGlowtypeData({
          title: { en: json.name || resultType, zh: json.name || resultType },
          tagline: { en: json.tagline || '', zh: json.tagline || '' },
          description: { en: descriptionText, zh: descriptionText },
          auraGradient: json.auraGradient || DEFAULT_STYLING.auraGradient,
          cardAccent: json.cardAccent || DEFAULT_STYLING.cardAccent,
          textColor: json.textColor || DEFAULT_STYLING.textColor,
        });
      } catch (e) {
        console.error('Failed to fetch glowtype data:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
        // Create minimal data with typeCode as title (no hardcoded fallback)
        setGlowtypeData({
          title: { en: resultType, zh: resultType },
          tagline: { en: '', zh: '' },
          description: { en: '', zh: '' },
          ...DEFAULT_STYLING,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchGlowtypeData();
  }, [resultType, lang]);

  // Reset insight when resultType or lang changes
  if (prevResultType.current !== resultType || prevLang.current !== lang) {
    prevResultType.current = resultType;
    prevLang.current = lang;
    if (insight !== null) {
      setInsight(null);
    }
  }

  const handleGenerateInsight = async () => {
    if (!glowtypeData) return;
    setIsGenerating(true);
    trackEvent('ai_insight_use', resultType);
    const systemPrompt = getPrompt('insight', lang, apiPrompts);
    const title = glowtypeData.title[lang];
    const description = glowtypeData.description[lang];
    const userPrompt = lang === 'zh'
      ? `我的情绪原型是「${title}」：${description}。请给我一句简短的宇宙洞察。`
      : `My emotional archetype is "${title}": ${description}. Give me a brief cosmic insight.`;
    const text = await callBackendInsight(userPrompt, systemPrompt, lang);
    setInsight(text);
    setIsGenerating(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-md mx-auto px-6 pt-28 pb-32 min-h-screen flex flex-col items-center justify-center relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-500">{lang === 'zh' ? '正在加载你的光芒类型...' : 'Loading your glowtype...'}</p>
        </motion.div>
      </div>
    );
  }

  // Use data (could be from API or minimal error fallback)
  const data = glowtypeData!;

  return (
    <div className="max-w-md mx-auto px-6 pt-28 pb-32 min-h-screen flex flex-col relative z-10">
      {error && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm text-center">
          {lang === 'zh' ? '无法加载完整数据，显示基本信息' : 'Could not load full data, showing basic info'}
        </div>
      )}
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

interface ChatViewProps {
  onEnd: () => void;
  lang: 'en' | 'zh';
  onCrisis: () => void;
  glowtypeCode?: string;
}

interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  resources?: CrisisResource[];
}

interface ApiDebugRequest {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  [key: string]: unknown;
}

interface RagScriptDebug {
  id: number;
  title: string;
  titleZh?: string;
  language?: string;
  crisisLevels?: string;
  score?: number;
  triggerKeywords?: string[];
}

interface RagDebugInfo {
  message: string;
  language: string;
  crisisLevel: number;
  retrieved: RagScriptDebug[];
  error?: string;
}

interface DebugInfo {
  sessionId: string;
  sessionContext: {
    glowtypeCode: string;
    glowtypeName: string;
    language: string;
    messageCount: number;
    isTest: boolean;
  } | null;
  systemPrompt: string;
  guidanceLoaded: Record<string, boolean>;
  promptLayers: Record<string, string>;
  lastApiRequest?: ApiDebugRequest;
  lastRag?: RagDebugInfo;
}

const ChatView = ({ onEnd, lang, onCrisis, glowtypeCode }: ChatViewProps) => {
  const t = TRANSLATIONS[lang].chat;
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, text: t.intro, sender: 'bot' }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const endOfMsgRef = useRef<HTMLDivElement>(null);

  // Debug panel state - check URL param or admin login
  const hasDebugAccess = (): boolean => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debug') === '1' || isAdminLoggedIn();
  };
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugReloadToken, setDebugReloadToken] = useState(0);
  const debugClickCount = useRef(0);
  const debugClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safely stringify unknown debug payloads
  const renderJson = (data: unknown) => {
    if (data === undefined || data === null) return '(empty)';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return '(unserializable)';
    }
  };

  // Secret tap to open debug panel (5 taps on disclaimer text)
  const handleDebugTap = () => {
    if (!hasDebugAccess()) return;
    debugClickCount.current++;
    if (debugClickTimer.current) clearTimeout(debugClickTimer.current);
    debugClickTimer.current = setTimeout(() => { debugClickCount.current = 0; }, 1000);
    if (debugClickCount.current >= 5) {
      debugClickCount.current = 0;
      setShowDebug(prev => !prev);
    }
  };

  useEffect(() => { endOfMsgRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  useEffect(() => {
    startChatSession({ language: lang, glowtypeCode }).then((id) => {
      if (id) setSessionId(id);
    });
  }, [lang, glowtypeCode]);

  // Keyboard shortcut for debug panel (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Use e.code for reliability across browsers/keyboards
      if (e.ctrlKey && e.shiftKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        if (hasDebugAccess()) {
          setShowDebug(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch debug info when panel is opened
  useEffect(() => {
    if (showDebug && sessionId) {
      const fetchDebug = async () => {
        setDebugLoading(true);
        try {
          // Get debug key from URL parameter
          const urlParams = new URLSearchParams(window.location.search);
          const debugKey = urlParams.get('key') || '';
          const res = await fetch(`${getApiBaseUrl()}/chat/debug/${sessionId}?key=${encodeURIComponent(debugKey)}`);
          if (res.ok) {
            const data = await res.json();
            setDebugInfo(data);
          }
        } catch (err) {
          console.error('Failed to fetch debug info:', err);
        } finally {
          setDebugLoading(false);
        }
      };
      fetchDebug();
    }
  }, [showDebug, sessionId, debugReloadToken]);

  // Build conversation history for API (exclude intro message, limit to last 10)
  const buildHistory = (): ChatHistoryItem[] => {
    return messages
      .slice(1) // Skip intro
      .slice(-10) // Last 10 messages
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })) as ChatHistoryItem[];
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    const newMsg: ChatMessage = { id: Date.now(), text: userMessage, sender: 'user' };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setIsTyping(true);

    // Ensure session exists
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const newSession = await startChatSession({ language: lang, glowtypeCode });
      if (newSession) {
        setSessionId(newSession);
        activeSessionId = newSession;
      } else {
        setIsTyping(false);
        setMessages(prev => [...prev, { id: Date.now() + 1, text: lang === 'zh' ? '暂时无法连接，请稍后再试。' : 'Unable to connect right now, please try again later.', sender: 'bot' }]);
        return;
      }
    }

    const history = buildHistory();
    const result = await sendChatMessage(activeSessionId, userMessage, lang, history);

    setIsTyping(false);

    const botMsg: ChatMessage = {
      id: Date.now() + 1,
      text: result.reply,
      sender: 'bot',
      resources: result.resources?.length > 0 ? result.resources : undefined,
    };
    setMessages(prev => [...prev, botMsg]);
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
              {/* Show crisis resources if available for this message */}
              {msg.sender === 'bot' && msg.resources && msg.resources.length > 0 && (
                <ResourceCard resources={msg.resources} lang={lang} />
              )}
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
        <p
          className="text-center text-[10px] text-gray-300 mt-2 select-none cursor-default"
          onClick={handleDebugTap}
        >
          {lang === 'zh' ? 'AI 可能会出错 · 隐私保护' : 'AI can make mistakes · Private'}
        </p>
      </div>

      {/* Debug Panel (Ctrl+Shift+D, 5x tap, or ?debug=1 in URL) */}
      {showDebug && hasDebugAccess() && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <h2 className="font-bold text-gray-900">Debug Panel</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDebugInfo(null);
                    setDebugReloadToken((x) => x + 1);
                  }}
                  className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                  disabled={debugLoading || !sessionId}
                >
                  Refresh
                </button>
              <button onClick={() => setShowDebug(false)} className="p-2 hover:bg-gray-200 rounded-lg">
                <X size={18} />
              </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4 text-sm">
              {debugLoading ? (
                <div className="text-center text-gray-500">Loading...</div>
              ) : debugInfo ? (
                <>
                  {/* Session Info */}
                  <div className="bg-blue-50 p-4 rounded-xl">
                    <h3 className="font-bold text-blue-800 mb-2">Session Context</h3>
                    <div className="grid grid-cols-2 gap-2 text-blue-700">
                      <div>Session ID: <code className="bg-blue-100 px-1 rounded">{debugInfo.sessionId}</code></div>
                      <div>Glowtype Code: <code className="bg-blue-100 px-1 rounded">{debugInfo.sessionContext?.glowtypeCode || 'N/A'}</code></div>
                      <div>Glowtype Name: <code className="bg-blue-100 px-1 rounded">{debugInfo.sessionContext?.glowtypeName || 'N/A'}</code></div>
                      <div>Language: <code className="bg-blue-100 px-1 rounded">{debugInfo.sessionContext?.language || 'N/A'}</code></div>
                      <div>Message Count: <code className="bg-blue-100 px-1 rounded">{debugInfo.sessionContext?.messageCount || 0}</code></div>
                      <div>Is Test: <code className="bg-blue-100 px-1 rounded">{String(debugInfo.sessionContext?.isTest || false)}</code></div>
                    </div>
                  </div>

                  {/* Frontend Props */}
                  <div className="bg-purple-50 p-4 rounded-xl">
                    <h3 className="font-bold text-purple-800 mb-2">Frontend Props</h3>
                    <div className="text-purple-700">
                      <div>glowtypeCode prop: <code className="bg-purple-100 px-1 rounded">{glowtypeCode || 'undefined'}</code></div>
                      <div>lang prop: <code className="bg-purple-100 px-1 rounded">{lang}</code></div>
                    </div>
                  </div>

                  {/* Guidance Loaded */}
                  <div className="bg-green-50 p-4 rounded-xl">
                    <h3 className="font-bold text-green-800 mb-2">Guidance Loaded</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(debugInfo.guidanceLoaded || {}).map(([code, loaded]) => (
                        <span key={code} className={`px-2 py-1 rounded text-xs ${loaded ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                          {code}: {loaded ? '✓' : '✗'}
                        </span>
                      ))}
                      {Object.keys(debugInfo.guidanceLoaded || {}).length === 0 && (
                        <span className="text-red-600">No guidance loaded!</span>
                      )}
                    </div>
                  </div>

                  {/* Prompt Layers */}
                  <div className="space-y-3">
                    {['safety', 'understanding', 'guidance'].map((layer) => (
                      <details key={layer} className="bg-gray-50 rounded-xl overflow-hidden">
                        <summary className="p-4 cursor-pointer font-bold text-gray-800 hover:bg-gray-100">
                          {layer.charAt(0).toUpperCase() + layer.slice(1)} Layer
                          {debugInfo.promptLayers?.[layer] ? ` (${debugInfo.promptLayers[layer].length} chars)` : ' (empty)'}
                        </summary>
                        <pre className="p-4 bg-gray-900 text-gray-100 text-xs overflow-x-auto whitespace-pre-wrap max-h-60">
                          {debugInfo.promptLayers?.[layer] || '(empty)'}
                        </pre>
                      </details>
                    ))}
                  </div>

                  {/* Full System Prompt */}
                  <details className="bg-amber-50 rounded-xl overflow-hidden">
                    <summary className="p-4 cursor-pointer font-bold text-amber-800 hover:bg-amber-100">
                      Full System Prompt ({debugInfo.systemPrompt?.length || 0} chars)
                    </summary>
                    <pre className="p-4 bg-gray-900 text-gray-100 text-xs overflow-x-auto whitespace-pre-wrap max-h-96">
                      {debugInfo.systemPrompt || '(empty)'}
                    </pre>
                  </details>

                  {/* RAG Retrieval */}
                  <details className="bg-teal-50 rounded-xl overflow-hidden">
                    <summary className="p-4 cursor-pointer font-bold text-teal-800 hover:bg-teal-100">
                      🧠 RAG Retrieval (vector search)
                    </summary>
                    <div className="p-4 space-y-3 text-teal-900 text-sm">
                      <div className="text-xs text-teal-700">
                        Message → embedding → vector search → top scripts (stored for prompt layer)
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="px-2 py-1 bg-white border border-teal-100 rounded-lg">
                          Message: <code className="bg-teal-100 px-1 rounded">{debugInfo.lastRag?.message || 'Not captured yet. Send a chat message.'}</code>
                        </span>
                        <span className="px-2 py-1 bg-white border border-teal-100 rounded-lg">
                          Lang: <code className="bg-teal-100 px-1 rounded">{debugInfo.lastRag?.language || 'n/a'}</code>
                        </span>
                        <span className="px-2 py-1 bg-white border border-teal-100 rounded-lg">
                          Crisis Level: <code className="bg-teal-100 px-1 rounded">{debugInfo.lastRag?.crisisLevel ?? 'n/a'}</code>
                        </span>
                        <span className="px-2 py-1 bg-white border border-teal-100 rounded-lg">
                          Retrieved: <code className="bg-teal-100 px-1 rounded">{debugInfo.lastRag?.retrieved?.length ?? 0}</code>
                        </span>
                      </div>
                      {debugInfo.lastRag?.error && (
                        <div className="text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                          ⚠️ RAG note: {debugInfo.lastRag.error}
                        </div>
                      )}
                      {debugInfo.lastRag?.retrieved && debugInfo.lastRag.retrieved.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-3">
                          {debugInfo.lastRag.retrieved.map((script) => (
                            <div key={script.id} className="bg-white border border-teal-100 rounded-lg p-3 shadow-sm">
                              <div className="flex items-center justify-between text-xs text-teal-800 mb-1">
                                <span className="font-semibold">#{script.id}</span>
                                {typeof script.score === 'number' && (
                                  <span className="px-2 py-0.5 bg-teal-100 rounded-full font-mono">
                                    score: {script.score.toFixed(3)}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-bold text-gray-900">
                                {debugInfo.lastRag?.language?.startsWith('zh') && script.titleZh
                                  ? script.titleZh
                                  : script.title}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                Lang: {script.language || 'n/a'} · Levels: {script.crisisLevels || 'all'}
                              </div>
                              {script.triggerKeywords && script.triggerKeywords.length > 0 && (
                                <div className="mt-2 text-[11px] text-gray-700">
                                  Keywords: {script.triggerKeywords.join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-teal-700">
                          No scripts retrieved yet. Send a chat message to trigger vector search.
                        </div>
                      )}
                    </div>
                  </details>

                  {/* Raw API Request (OpenAI format) */}
                  <details className="bg-blue-50 rounded-xl overflow-hidden">
                    <summary className="p-4 cursor-pointer font-bold text-blue-800 hover:bg-blue-100">
                      🔌 Raw API Request (full JSON sent to AI)
                    </summary>
                    <div className="p-4 bg-gray-900 text-xs text-green-100 space-y-3">
                      <div>
                        <div className="text-[11px] text-gray-300 mb-1">Full payload (method, headers, body)</div>
                        <pre className="bg-black/30 border border-gray-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-[400px]">
                          {renderJson(debugInfo.lastApiRequest)}
                        </pre>
                      </div>
                      {debugInfo.lastApiRequest?.body !== undefined ? (
                        <div>
                          <div className="text-[11px] text-gray-300 mb-1">Request body sent to provider</div>
                          <pre className="bg-black/30 border border-gray-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-[400px]">
                            {renderJson(debugInfo.lastApiRequest.body)}
                          </pre>
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-300">
                          No API payload captured yet. Send a chat message (and ensure provider is OpenAI) to populate.
                        </div>
                      )}
                    </div>
                  </details>
                </>
              ) : (
                <div className="text-center text-gray-500">
                  {sessionId ? 'Failed to load debug info' : 'No session yet'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



interface SafetyViewProps {
  onBack: () => void;
  lang: 'en' | 'zh';
}

const SafetyView = ({ onBack, lang }: SafetyViewProps) => {
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

// LearnView imported from ./views/LearnView

// --- TERMS VIEW ---
interface TermsViewProps {
  onBack: () => void;
  lang: 'en' | 'zh';
}

const TermsView = ({ onBack, lang }: TermsViewProps) => {
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
interface PrivacyViewProps {
  onBack: () => void;
  lang: 'en' | 'zh';
}

const PrivacyView = ({ onBack, lang }: PrivacyViewProps) => {
  const isZh = lang === 'zh';
  return (
    <div className="max-w-3xl mx-auto px-6 pt-28 pb-32 min-h-screen relative z-10">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors">
        <ArrowRight className="rotate-180" size={20} /> {isZh ? '返回' : 'Back'}
      </button>
      <h1 className="text-4xl font-serif text-gray-900 mb-2">{isZh ? '隐私政策' : 'Privacy Policy'}</h1>
      <p className="text-sm text-gray-400 mb-8">{isZh ? '最后更新：2025年12月01日' : 'Last updated: December 1, 2025'}</p>

      <GlassCard className="p-6 md:p-8">
        {isZh ? <PrivacyContentZh /> : <PrivacyContentEn />}
      </GlassCard>
    </div>
  );
};

// --- UPDATED CRISIS VIEW: CLEAR & ORGANIZED ---
interface CrisisViewProps {
  onBack: () => void;
  lang: 'en' | 'zh';
}

const CrisisView = ({ onBack, lang }: CrisisViewProps) => {
  const t = TRANSLATIONS[lang].crisis;
  const hotlines = APP_CONFIG.hotlines;

  // Pre-compute random meteor data to avoid impure render
  const meteorData = useMemo(() =>
    [...Array(3)].map((_, i) => ({
      id: i,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      repeatDelay: Math.random() * 3 + 2,
      left: `${10 + Math.random() * 80}%`,
    })), []
  );

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
        {meteorData.map((m) => (
          <Meteor
            key={m.id}
            delay={m.delay}
            duration={m.duration}
            repeatDelay={m.repeatDelay}
            style={{ left: m.left, top: '-20%' }}
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
interface NavbarProps {
  view: string;
  setView: (view: string) => void;
  toggleLang: () => void;
  tNav: { safety: string; learn: string; lang: string };
}

const Navbar = memo(({ view, setView, toggleLang, tNav }: NavbarProps) => {
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
        <button onClick={() => setView('learn')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors px-2 sm:px-3 py-1.5 rounded-full hover:bg-indigo-50"><BookOpen size={16} /> <span className="hidden sm:inline">{tNav.learn}</span></button>
        {view === 'landing' && (<button onClick={() => setView('safety')} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">{tNav.safety}</button>)}
        <button onClick={toggleLang} className="flex items-center gap-1 bg-gray-100/80 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full text-xs font-bold transition-colors tracking-wide backdrop-blur-sm"><Globe size={12} />{tNav.lang}</button>
      </div>
    </nav>
  );
});

// Check for special routes on initial load
const getInitialView = (): string => {
  if (typeof window !== 'undefined') {
    if (window.location.pathname === '/terms') return 'terms';
    if (window.location.pathname === '/privacy') return 'privacy';
    if (window.location.pathname === '/learn') return 'learn';
    if (window.location.pathname === '/quiz') return 'quiz';
    if (window.location.pathname === '/safety') return 'safety';
  }
  return 'landing';
};

// Check route type (called only once at module level)
  const getRouteType = (): 'admin' | 'share-render' | 'main' => {
  if (typeof window !== 'undefined') {
    if (window.location.pathname.startsWith('/admin')) return 'admin';
    if (window.location.pathname.startsWith('/share-render')) return 'share-render';
  }
  return 'main';
};

const MainApp = () => {
  const [view, setView] = useState(getInitialView); // Initialize from URL
  const [lang, setLang] = useState<'en' | 'zh'>('en');
  const [resultType, setResultType] = useState<string | null>(null);
  const [apiPrompts, setApiPrompts] = useState<Record<string, string>>({});

  // Fetch AI prompts from API on mount
  useEffect(() => {
    fetchPrompts().then(setApiPrompts);
  }, []);

  const toggleLang = () => setLang(prev => (prev === 'en' ? 'zh' : 'en'));
  const handleQuizComplete = (type: string) => {
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
      // Accept any type from URL - API will validate if it's a valid glowtype
      if (urlType) {
        setResultType(urlType);
        setView('result');
      }
    } catch (e) {
      console.error('Failed to parse URL params', e);
    }
  }, []);

  // Keep URL in sync with current view and params
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('lang', lang);
      if (resultType) {
        params.set('type', resultType);
      } else {
        params.delete('type');
      }
      const search = params.toString();

      // Determine the correct pathname based on view
      const viewToPath: Record<string, string> = {
        landing: '/',
        learn: '/learn',
        quiz: '/quiz',
        safety: '/safety',
        terms: '/terms',
        privacy: '/privacy',
      };
      const pathname = viewToPath[view] || '/';
      const newUrl = `${pathname}${search ? `?${search}` : ''}`;

      // Only update if different to avoid infinite loops
      if (window.location.pathname !== pathname) {
        window.history.pushState({}, '', newUrl);
      } else {
        window.history.replaceState({}, '', newUrl);
      }
    } catch (e) {
      console.error('Failed to sync URL params', e);
    }
  }, [lang, resultType, view]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/learn') setView('learn');
      else if (path === '/quiz') setView('quiz');
      else if (path === '/safety') setView('safety');
      else if (path === '/terms') setView('terms');
      else if (path === '/privacy') setView('privacy');
      else setView('landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const showChrome = view !== 'chat' && view !== 'crisis';

  return (
    <div className="min-h-screen bg-[#FDFCFE] text-gray-900 font-sans overflow-x-hidden relative selection:bg-purple-200">
      <GlobalBackground />
      {showChrome && (
        <Navbar view={view} setView={setView} toggleLang={toggleLang} tNav={tNav} />
      )}
      <main className={`relative ${showChrome ? 'z-10' : 'z-[70]'}`}>
        <AnimatePresence mode="wait">
          {view === 'landing' && (<motion.div key="landing" exit={{ opacity: 0, y: -20 }} className="absolute w-full top-0"><HeroView onStart={() => setView('quiz')} onViewSafety={() => setView('safety')} lang={lang} /></motion.div>)}
          {view === 'quiz' && (<motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute w-full top-0"><QuizView onComplete={handleQuizComplete} lang={lang} /></motion.div>)}
          {view === 'result' && (<motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute w-full top-0"><ResultView onChat={() => { trackEvent('ai_chat_start'); setView('chat'); }} onHelp={() => setView('crisis')} lang={lang} resultType={resultType} apiPrompts={apiPrompts} /></motion.div>)}
          {view === 'chat' && (<motion.div key="chat" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25 }} className="fixed inset-0 z-50 bg-white"><ChatView onEnd={() => setView('result')} lang={lang} onCrisis={() => setView('crisis')} glowtypeCode={resultType || undefined} /></motion.div>)}
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

// Route wrapper - no hooks before conditional returns
const AppShell = () => {
  const routeType = getRouteType();

  if (routeType === 'admin') {
    return (
      <BrowserRouter>
        <AdminLayout />
      </BrowserRouter>
    );
  }

  if (routeType === 'share-render') {
    return <ShareRenderPage />;
  }

  return <MainApp />;
};

export default AppShell;
