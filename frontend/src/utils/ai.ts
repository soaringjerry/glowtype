// AI API utilities proxied through backend to avoid exposing API keys
import { getApiBaseUrl } from '../api/baseUrl';

export const callAI = async (prompt: string, systemInstruction: string, lang: string): Promise<string> => {
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

export const callAIChat = async (
  sessionId: string,
  message: string,
  lang: string,
): Promise<string> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message, language: lang }),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.reply || "Connection interrupted.";
  } catch (error) {
    console.error("AI API Error:", error);
    return lang === 'zh' ? '抱歉，稍后再试。' : "Sorry, please try again later.";
  }
};

// Default AI prompts
export const DEFAULT_AI_PROMPTS = {
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

export const fetchPrompts = async (): Promise<Record<string, string>> => {
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
export const getPrompt = (
  type: 'insight' | 'chat',
  lang: 'en' | 'zh',
  apiPrompts: Record<string, string>
): string => {
  const apiKey = type === 'insight'
    ? `cosmic_insight_system_${lang}`
    : `chat_system_${lang}`;
  return apiPrompts[apiKey] || DEFAULT_AI_PROMPTS[type][lang];
};
