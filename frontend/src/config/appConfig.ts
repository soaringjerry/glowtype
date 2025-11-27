// App configuration - quiz questions, glowtypes, glow sticks, hotlines

export const APP_CONFIG = {
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
  } as Record<string, {
    title: { en: string; zh: string };
    tagline: { en: string; zh: string };
    description: { en: string; zh: string };
    auraGradient: string;
    cardAccent: string;
    textColor: string;
  }>,

  // 魔法书章节定义
  bookChapters: [
    { id: "calm", name: { en: "Chapter of Stillness", zh: "静心篇" }, desc: { en: "When you need to slow down", zh: "当你需要慢下来" }, icon: "🌙", color: "indigo" },
    { id: "anxiety", name: { en: "Chapter of Grounding", zh: "着陆篇" }, desc: { en: "For racing thoughts", zh: "当思绪翻涌" }, icon: "🌿", color: "emerald" },
    { id: "self-care", name: { en: "Chapter of Kindness", zh: "温柔篇" }, desc: { en: "Be gentle with yourself", zh: "善待自己" }, icon: "💗", color: "rose" },
    { id: "courage", name: { en: "Chapter of Courage", zh: "勇气篇" }, desc: { en: "Find your strength", zh: "寻找力量" }, icon: "🔥", color: "amber" },
    { id: "random", name: { en: "Mystery Page", zh: "神秘页" }, desc: { en: "Let fate decide", zh: "让命运决定" }, icon: "✨", color: "violet" }
  ],

  glowSticks: [
    { id: 1, title: { en: "Feelings Are Signals", zh: "情绪是信号" }, message: { en: "Your emotions are messengers, not commanders. They bring information, but you decide what to do with it.", zh: "情绪是信使，不是指挥官。它们带来信息，但由你决定如何回应。" }, color: "from-violet-400 to-indigo-500", planet: "calm", forTypes: ["Quiet Comet", "Radiant Nebula"] },
    { id: 2, title: { en: "Ground Yourself", zh: "让自己落地" }, message: { en: "When thoughts spiral, try 5-4-3-2-1: See 5 things, touch 4, hear 3, smell 2, taste 1. You're here, now.", zh: "当思绪翻涌时，试试 5-4-3-2-1：看5样、摸4样、听3样、闻2样、尝1样。你在这里，此刻。" }, color: "from-emerald-400 to-teal-500", planet: "anxiety", forTypes: ["Quiet Comet", "Radiant Nebula"] },
    { id: 3, title: { en: "Anxiety Is Your Alarm", zh: "焦虑是你的警报" }, message: { en: "That racing heart? Your brain protecting you. It's uncomfortable, not dangerous. Breathe—the alarm will quiet.", zh: "心跳加速？那是大脑在保护你。不舒服，但不危险。深呼吸——警报会平息。" }, color: "from-amber-400 to-orange-500", planet: "anxiety", forTypes: ["Quiet Comet", "Radiant Nebula"] },
    { id: 4, title: { en: "You're Not Broken", zh: "你没有坏掉" }, message: { en: "Mood swings in your teens and twenties are normal—hormones are intense. You're not broken, you're becoming.", zh: "青春期情绪波动是正常的——荷尔蒙在作祟。你没有坏掉，你在成长。" }, color: "from-rose-400 to-pink-500", planet: "self-care", forTypes: ["Radiant Nebula"] },
    { id: 5, title: { en: "Rest Is Sacred", zh: "休息是神圣的" }, message: { en: "You can't pour from an empty cup. Rest isn't laziness—it's how you refill. Take care of yourself first.", zh: "空杯子倒不出水。休息不是懒惰——是重新注满自己。先照顾好自己。" }, color: "from-sky-400 to-blue-500", planet: "calm", forTypes: ["Quiet Comet", "Radiant Nebula"] },
    { id: 6, title: { en: "Asking for Help", zh: "寻求帮助" }, message: { en: "Reaching out isn't weakness—it's wisdom. The strongest people know they don't have to carry everything alone.", zh: "求助不是软弱——是智慧。最坚强的人知道，不必独自扛下一切。" }, color: "from-fuchsia-400 to-purple-500", planet: "courage", forTypes: ["Quiet Comet", "Radiant Nebula"] },
    { id: 7, title: { en: "This Moment Will Pass", zh: "这一刻会过去" }, message: { en: "No feeling is final. Like weather, emotions come and go. The storm always passes, even when it doesn't feel that way.", zh: "没有任何情绪是永恒的。像天气一样，情绪来了又走。风暴终会过去，即使此刻感觉不到。" }, color: "from-cyan-400 to-teal-500", planet: "anxiety", forTypes: ["Radiant Nebula"] },
    { id: 8, title: { en: "You Deserve Kindness", zh: "你值得被温柔对待" }, message: { en: "Talk to yourself like you'd talk to a friend. You deserve the same kindness you give to others.", zh: "用对待朋友的方式对待自己。你值得拥有你给予他人的那份温柔。" }, color: "from-lime-400 to-green-500", planet: "self-care", forTypes: ["Quiet Comet", "Radiant Nebula"] },
    { id: 9, title: { en: "Your Chaos Is Creative", zh: "你的混乱是创造力" }, message: { en: "That whirlwind inside you? It's not a flaw—it's raw creative energy. Channel it, don't fight it.", zh: "内心的风暴？不是缺陷——是原始的创造能量。引导它，而非对抗它。" }, color: "from-orange-400 to-red-500", planet: "courage", forTypes: ["Radiant Nebula"] },
    { id: 10, title: { en: "Silence Is Strength", zh: "沉默是力量" }, message: { en: "Your quiet observation isn't absence—it's presence. You see what others miss. That's your superpower.", zh: "你的安静观察不是缺席——是在场。你看到别人忽略的。这是你的超能力。" }, color: "from-indigo-400 to-blue-500", planet: "courage", forTypes: ["Quiet Comet"] },
    { id: 11, title: { en: "Breathe Through It", zh: "呼吸穿越它" }, message: { en: "Inhale calm, exhale tension. Your breath is always with you—a portable reset button for your nervous system.", zh: "吸入平静，呼出紧张。呼吸永远与你同在——随身携带的神经系统重启键。" }, color: "from-teal-400 to-cyan-500", planet: "anxiety", forTypes: ["Quiet Comet", "Radiant Nebula"] },
    { id: 12, title: { en: "Small Steps Count", zh: "小步也算数" }, message: { en: "You don't have to climb the whole mountain today. One step forward is still forward.", zh: "你不必今天就爬完整座山。往前一步，依然是前进。" }, color: "from-green-400 to-emerald-500", planet: "courage", forTypes: ["Quiet Comet", "Radiant Nebula"] }
  ],

  hotlines: [
    { category: "call", name: "SOS (Samaritans)", action: "1-767", actionLabel: { en: "Call 1-767", zh: "拨打 1-767" }, desc: { en: "24/7 emotional support for anyone in distress.", zh: "24小时情感支持，给任何需要的人。" } },
    { category: "call", name: "IMH Helpline", action: "6389-2222", actionLabel: { en: "Call 6389-2222", zh: "拨打 6389-2222" }, desc: { en: "For mental health emergencies.", zh: "针对心理健康紧急状况。" } },
    { category: "text", name: "Limitless Singapore", action: "https://www.limitless.sg/talk", actionLabel: { en: "Get Help", zh: "获取帮助" }, desc: { en: "Text-based counseling for youths (12-25).", zh: "专为 12-25 岁青年提供的文字辅导。" }, highlight: true },
    { category: "text", name: "Befrienders", action: "https://www.befrienders.org", actionLabel: { en: "Find Center", zh: "查找中心" }, desc: { en: "International support network.", zh: "国际情感支持网络。" } }
  ]
};

export type GlowStick = typeof APP_CONFIG.glowSticks[0];
export type BookChapter = typeof APP_CONFIG.bookChapters[0];
export type Glowtype = typeof APP_CONFIG.glowtypes[keyof typeof APP_CONFIG.glowtypes];
