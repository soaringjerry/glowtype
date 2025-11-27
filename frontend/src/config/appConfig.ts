// App configuration - safety-critical hotlines only
// All business data (glowtypes, questions, glowpedia) comes from API

export const APP_CONFIG = {
  // Crisis hotlines - intentionally hardcoded for reliability
  // These should always be available even if API is down
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
      highlight: true
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

// Type exports for hotlines
export type Hotline = typeof APP_CONFIG.hotlines[0];
