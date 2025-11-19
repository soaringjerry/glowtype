// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
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

// --- GEMINI API UTILITIES ---

const apiKey = ""; // System will inject the key at runtime

const callGemini = async (prompt, systemInstruction) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
        }),
      }
    );

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Connection interrupted.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm having a little trouble connecting. Please try again.";
  }
};

const TRANSLATIONS = {
  en: {
    nav: { safety: "Safety", learn: "Learn", lang: "中文" },
    hero: { tag: "For ages 15–25 • Free • Anonymous", titlePre: "What's your", titleHighlight: "Glowtype?", subtitle: "A playful emotional mirror. Not a diagnosis, just a lighter way to understand your inner universe.", btnStart: "Start the Quiz", btnSafe: "Is this safe? How it works" },
    quiz: { question: "Question", total: "Total", back: "Back" },
    result: { label: "Your Glowtype", insightBtn: "Reveal Cosmic Insight", insightLoading: "Decoding Signal...", note: "Note: This is not a medical diagnosis. It's a tool for self-reflection.", btnChat: "Chat about this (AI)", btnHelp: "Find professional help", shareTitle: "Share your Glow", shareDesc: "Save this card or share link", promptContext: "Answer in English." },
    chat: { header: "Anonymous Chat", end: "End Chat", disclaimer: "Private • No Data Saved • Powered by Gemini", intro: "Hi there. I'm Glowtype AI. I'm here to listen gently. I'm not a human, but I care about what you have to say.", placeholder: "Type here...", crisisResponse: "I hear that you are in pain, but I am just an AI. Please, for your safety, use the red Crisis Help button below to talk to a real person who can help." },
    safety: { back: "Back", title: "Is it safe?", card1Title: "Privacy First", card1Desc: "We do not ask for your real name, phone number, or email. Your answers are processed in your browser session.", card2Title: "Anonymous AI Chat", card2Desc: "The chat is powered by AI (Gemini). It does not judge. Chat logs are transient. Please do not share personal info.", card3Title: "Crisis Support", card3Desc: "Glowtype is NOT a replacement for professional therapy. If you are in danger, please use the red button below." },
    learn: { title: "Glowpedia", subtitle: "Understanding the science of you.", back: "Home" },
    crisis: { title: "Here for you", subtitle: "Whatever you're going through, help is available.", back: "Close", sectionCall: "Immediate Help (24/7)", sectionText: "Text & Counseling" },
    footer: { label: "Need someone to talk to?", btn: "Support is here" }
  },
  zh: {
    nav: { safety: "安全说明", learn: "科普", lang: "English" },
    hero: { tag: "面向 15–25 岁 • 免费 • 匿名", titlePre: "测测你的", titleHighlight: "光芒人格?", subtitle: "一面有趣的情绪镜子。不是医疗诊断，而是一种探索内心宇宙的轻松方式。", btnStart: "开始测试", btnSafe: "安全吗？如何运作" },
    quiz: { question: "第", total: "题 / 共", back: "返回上一题" },
    result: { label: "你的光芒类型", insightBtn: "揭示宇宙洞察", insightLoading: "正在连接星辰...", note: "注意：这不是医疗诊断。这只是一个自我探索的工具。", btnChat: "聊聊这个 (AI 陪伴)", btnHelp: "寻找专业帮助", shareTitle: "分享你的光芒", shareDesc: "保存卡片或复制链接", promptContext: "请用温暖、治愈的中文回答，像个知心朋友。" },
    chat: { header: "匿名树洞", end: "结束对话", disclaimer: "隐私保护 • 不保存数据 • Gemini AI 驱动", intro: "你好呀。我是 Glowtype AI。我会在这里静静倾听。虽然我不是人类，但我很在乎你想说的话。", placeholder: "在这里输入...", crisisResponse: "我听到了你的痛苦，但我只是一个 AI。为了你的安全，请立刻点击下方的红色“获取危机援助”按钮，寻找真人的帮助。" },
    safety: { back: "返回", title: "这安全吗？", card1Title: "隐私优先", card1Desc: "我们不需要你的真名、电话或邮箱。你的测试答案仅在浏览器中处理，不会建立个人档案。", card2Title: "匿名 AI 聊天", card2Desc: "聊天由 AI (Gemini) 驱动。它不会评判你。聊天记录是暂时的，结束后即销毁。请勿分享个人隐私。", card3Title: "危机支持", card3Desc: "Glowtype 不能替代专业治疗。如果你处于危险中，请务必使用屏幕底部的红色按钮求助。" },
    learn: { title: "光芒百科", subtitle: "探索情绪背后的科学。", back: "返回首页" },
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
  learnContent: [
    { id: 1, icon: BrainCircuit, title: { en: "The Science of 'Feeling'", zh: "情绪的科学机制" }, desc: { en: "Emotions are just chemical signals, not facts.", zh: "情绪只是大脑的化学信号，并不等于现实。" } },
    { id: 2, icon: Wind, title: { en: "Why We Need Rest", zh: "为什么我们需要休息" }, desc: { en: "Rest isn't laziness. It's system maintenance.", zh: "休息不是懒惰，而是系统的必要维护。" } },
    { id: 3, icon: Lightbulb, title: { en: "Grounding 101", zh: "着陆练习入门" }, desc: { en: "Simple techniques to stop the spinning.", zh: "几个简单的技巧，帮你停止精神内耗。" } }
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

const GlobalBackground = React.memo(() => (
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
const Meteor = React.memo(({ delay, duration, style }) => (
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
  const questions = APP_CONFIG.quizQuestions;
  const t = TRANSLATIONS[lang].quiz;

  const handleAnswer = (value) => {
    if (currentQ < questions.length - 1) {
      setDirection(1);
      setCurrentQ(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentQ > 0) {
      setDirection(-1);
      setCurrentQ(prev => prev - 1);
    }
  };

  const progress = ((currentQ + 1) / questions.length) * 100;

  return (
    <div className="max-w-xl mx-auto px-6 pt-28 pb-24 min-h-screen flex flex-col justify-center relative z-10">
      <div className="mb-8">
        <div className="flex justify-between text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
          <span>{t.question} {currentQ + 1}</span>
          {lang === 'en' ? <span>{questions.length} {t.total}</span> : <span>{t.total} {questions.length} {t.question}</span>}
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div className="h-full bg-gray-900" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: "easeInOut" }} />
        </div>
      </div>

      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentQ}
            custom={direction}
            initial={{ x: direction * 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -50, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute w-full"
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
                  className="w-full text-left p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 hover:bg-purple-50/30 transition-all duration-300 group"
                >
                  <span className="text-lg text-gray-700 group-hover:text-gray-900">{opt.text[lang]}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {currentQ > 0 && (
        <button onClick={handleBack} className="fixed bottom-24 left-6 text-gray-400 hover:text-gray-600 transition-colors">{t.back}</button>
      )}
    </div>
  );
};

const ResultView = ({ onChat, onTips, onHelp, lang, resultType }) => {
  const data = APP_CONFIG.glowtypes[resultType || "Quiet Comet"];
  const t = TRANSLATIONS[lang].result;
  const [insight, setInsight] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => { setInsight(null); }, [lang]);

  const handleGenerateInsight = async () => {
    setIsGenerating(true);
    const systemPrompt = `You are a poetic, gentle companion... ${t.promptContext}`;
    const userPrompt = `Archetype: ${data.title[lang]}. ${data.description[lang]}. Insight?`;
    const text = await callGemini(userPrompt, systemPrompt);
    setInsight(text);
    setIsGenerating(false);
  };

  return (
    <div className="max-w-md mx-auto px-6 pt-28 pb-12 min-h-screen flex flex-col relative z-10">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="flex-grow flex flex-col items-center">
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-2">{t.label}</p>
          <h2 className="text-4xl font-serif text-gray-900">{data.title[lang]}</h2>
        </div>

        <div className="relative w-full aspect-[3/5] mb-8 group perspective-1000">
          <motion.div
            initial={{ rotateY: 180, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 1, type: "spring" }}
            className={`relative h-full w-full rounded-[32px] overflow-hidden bg-gradient-to-br ${data.cardAccent} shadow-2xl border-[6px] border-white/60`}
          >
            <div className="absolute inset-0 opacity-[0.6] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay pointer-events-none" />
            <div className="absolute top-6 left-0 w-full flex justify-center z-20">
              <div className="bg-white/30 backdrop-blur-md border border-white/50 px-3 py-1 rounded-full">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-900">Rare Prototype</span>
              </div>
            </div>
            <div className="absolute top-0 left-0 w-full h-[65%] flex items-center justify-center overflow-hidden">
              <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="w-48 h-48 rounded-full blur-[40px] mix-blend-multiply" style={{ background: data.auraGradient }} />
              <motion.div animate={{ scale: [1.2, 1, 1.2], x: [10, -10, 10] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute w-40 h-40 rounded-full blur-[50px] mix-blend-multiply opacity-60" style={{ background: data.auraGradient, filter: 'hue-rotate(30deg)' }} />
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(255,255,255,0.1)_50%)] bg-[length:100%_4px] pointer-events-none" />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-[45%] z-10">
              <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/70 to-transparent backdrop-blur-[2px]" />
              <div className="relative z-20 p-6 h-full flex flex-col justify-end">
                <div className="pt-6 border-t border-white/40">
                  <h3 className={`text-2xl font-serif ${data.textColor} mb-1`}>{data.title[lang]}</h3>
                  <p className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-4">{data.tagline[lang]}</p>
                  <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
                  <div className="h-28 overflow-y-auto no-scrollbar pr-1">
                    <AnimatePresence mode="wait">
                      {insight ? (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-indigo-600 italic leading-relaxed">✨ "{insight}"</motion.p>
                      ) : (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-gray-600 leading-relaxed">{data.description[lang]}</motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="flex justify-between items-end pt-4 opacity-50">
                  <span className="text-[9px] font-mono text-gray-500">GEN-1 // {new Date().getFullYear()}</span>
                  <Sparkles size={10} className="text-indigo-400" />
                </div>
              </div>
            </div>
          </motion.div>
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
              <button className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-500 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-sm transition-all active:scale-95" onClick={() => alert("Simulated: Image Saved")}><Download size={18} /></button>
              <button className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-500 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-sm transition-all active:scale-95" onClick={() => alert("Simulated: Link Copied")}><Copy size={18} /></button>
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

const ChatView = ({ onEnd, lang, onCrisis }) => {
  const t = TRANSLATIONS[lang].chat;
  const [messages, setMessages] = useState([{ id: 1, text: t.intro, sender: 'bot' }]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endOfMsgRef = useRef(null);

  useEffect(() => { endOfMsgRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const newMsg = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setIsTyping(true);
    const systemPrompt = `You are a supportive, gentle AI companion...`;
    const botResponseText = await callGemini(input, systemPrompt);
    setIsTyping(false);
    setMessages(prev => [...prev, { id: Date.now() + 1, text: botResponseText, sender: 'bot' }]);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#FDFCFE] relative z-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100 p-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-50 flex items-center justify-center border border-white shadow-sm">
            <Sparkles size={18} className="text-indigo-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm leading-tight">Glowtype AI</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCrisis}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-full text-xs font-bold border border-rose-100 hover:bg-rose-100 transition-colors"
          >
            <Heart size={12} className="fill-rose-500/20" />
            <span>Crisis Support</span>
          </button>
          <button onClick={onEnd} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Disclaimer Banner */}
      <div className="bg-indigo-50/60 px-4 py-1.5 text-center border-b border-indigo-100/50 backdrop-blur-sm">
        <p className="text-[10px] font-medium text-indigo-400 flex items-center justify-center gap-1.5">
          <ShieldCheck size={10} /> {t.disclaimer}
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-6 pb-32">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${msg.sender === 'user' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-100 text-indigo-600 shadow-sm'}`}>
                {msg.sender === 'user' ? 'You' : <Sparkles size={14} />}
              </div>

              {/* Bubble */}
              <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative group ${msg.sender === 'user'
                ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-tr-none'
                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                }`}>
                {msg.text}
                {msg.sender === 'bot' && (
                  <div className="absolute -bottom-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-400 pl-2 pt-1">
                    AI-generated
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-white border border-gray-100 text-indigo-600 shadow-sm">
                <Sparkles size={14} />
              </div>
              <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1 items-center h-10">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={endOfMsgRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-white via-white/90 to-transparent pt-10 z-40">
        {/* Mobile Crisis Button (Visible only on small screens) */}
        <div className="md:hidden flex justify-center mb-3">
          <button
            onClick={onCrisis}
            className="flex items-center gap-1.5 px-3 py-1 bg-rose-50/80 text-rose-600 rounded-full text-[10px] font-bold border border-rose-100 backdrop-blur-md"
          >
            <Heart size={10} className="fill-rose-500/20" />
            Need help? Crisis Support
          </button>
        </div>

        <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-center gap-2 shadow-2xl shadow-indigo-100/50 rounded-[2rem] p-1.5 bg-white border border-gray-100">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            className="flex-grow bg-transparent px-5 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none text-sm md:text-base"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 md:w-12 md:h-12 bg-gray-900 rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-gray-900/20"
          >
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="text-center text-[10px] text-gray-300 mt-3 font-medium">
          Glowtype AI can make mistakes.
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

const LearnView = ({ onBack, lang }) => {
  const t = TRANSLATIONS[lang].learn;
  const content = APP_CONFIG.learnContent;
  return (
    <div className="max-w-2xl mx-auto px-6 pt-28 pb-12 min-h-screen relative z-10">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors">
        <ArrowRight className="rotate-180" size={20} /> {t.back}
      </button>
      <div className="mb-10">
        <h1 className="text-4xl font-serif text-gray-900 mb-2">{t.title}</h1>
        <p className="text-gray-500">{t.subtitle}</p>
      </div>
      <div className="grid gap-4">
        {content.map((item) => (
          <GlassCard key={item.id} className="p-6 hover:bg-white/80 transition-colors cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                <item.icon size={24} />
              </div>
              <div className="flex-grow">
                <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">{item.title[lang]}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc[lang]}</p>
              </div>
              <div className="text-gray-300 group-hover:text-indigo-400 transition-colors">
                <ArrowRight size={20} />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
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
const Navbar = React.memo(({ view, setView, lang, toggleLang, tNav }) => {
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
  const [view, setView] = useState('landing');
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState('en');
  const [resultType, setResultType] = useState(null);

  const toggleLang = useCallback(() => setLang(prev => prev === 'en' ? 'zh' : 'en'), []);
  const handleQuizComplete = () => {
    const type = Math.random() > 0.5 ? "Quiet Comet" : "Radiant Nebula";
    setResultType(type);
    setView('result');
  };

  useEffect(() => { setTimeout(() => setLoading(false), 1500); }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#FDFCFE] overflow-hidden relative">
        <GlobalBackground />
        <motion.div animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="w-16 h-16 bg-gradient-to-tr from-indigo-300 to-pink-300 rounded-full blur-xl relative z-10" />
      </div>
    );
  }

  const tNav = TRANSLATIONS[lang].nav;
  const tFooter = TRANSLATIONS[lang].footer;

  return (
    <div className="min-h-screen bg-[#FDFCFE] text-gray-900 font-sans overflow-x-hidden relative selection:bg-purple-200">
      <GlobalBackground />
      <Navbar view={view} setView={setView} lang={lang} toggleLang={toggleLang} tNav={tNav} />
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {view === 'landing' && (<motion.div key="landing" exit={{ opacity: 0, y: -20 }} className="absolute w-full top-0"><HeroView onStart={() => setView('quiz')} onViewSafety={() => setView('safety')} lang={lang} /></motion.div>)}
          {view === 'quiz' && (<motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute w-full top-0"><QuizView onComplete={handleQuizComplete} lang={lang} /></motion.div>)}
          {view === 'result' && (<motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute w-full top-0"><ResultView onChat={() => setView('chat')} onTips={() => alert("Hydrate & Rest!")} onHelp={() => setView('crisis')} lang={lang} resultType={resultType} /></motion.div>)}
          {view === 'chat' && (<motion.div key="chat" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25 }} className="fixed inset-0 z-50 bg-white"><ChatView onEnd={() => setView('result')} lang={lang} onCrisis={() => setView('crisis')} /></motion.div>)}
          {view === 'safety' && (<motion.div key="safety" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute w-full top-0 z-30"><SafetyView onBack={() => setView('landing')} lang={lang} /></motion.div>)}
          {view === 'learn' && (<motion.div key="learn" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute w-full top-0 z-30"><LearnView onBack={() => setView('landing')} lang={lang} /></motion.div>)}
        </AnimatePresence>

        <AnimatePresence>
          {view === 'crisis' && (
            <div className="fixed inset-0 z-[60]">
              <CrisisView onBack={() => setView('landing')} lang={lang} />
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer with Functional Crisis Button */}
      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 w-full bg-white/80 backdrop-blur-lg border-t border-gray-100 p-4 z-40 pb-safe">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-xs md:text-sm">
          <span className="text-gray-500">{tFooter.label}</span>
          <button
            onClick={() => setView('crisis')}
            className="text-rose-500 font-bold flex items-center gap-1 hover:text-rose-600 hover:underline decoration-rose-300 decoration-2 underline-offset-2 transition-all"
          >
            <Heart size={14} className="fill-rose-500/20" /> {tFooter.btn}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AppShell;
