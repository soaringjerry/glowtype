import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost } from '../api/client';

type ChatSessionResponse = {
  sessionId: string;
};

type ChatMessageResponse = {
  reply: string;
  safetyNotice?: string | null;
};

type ChatBubble = {
  id: string;
  from: 'user' | 'bot';
  text: string;
};

export function ChatPage() {
  const { i18n } = useTranslation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const lang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en';
    apiPost<ChatSessionResponse, { language: string }>('/chat/session', { language: lang })
      .then((res) => setSessionId(res.sessionId))
      .catch(() => setSessionId(null));
  }, [i18n.language]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !sessionId) return;
    const lang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en';

    const userBubble: ChatBubble = {
      id: `${Date.now()}-u`,
      from: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userBubble]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiPost<ChatMessageResponse, { sessionId: string; message: string; language: string }>(
        '/chat/message',
        {
          sessionId,
          message: trimmed,
          language: lang,
        },
      );
      const botText = [res.reply, res.safetyNotice].filter(Boolean).join('\n\n');
      const botBubble: ChatBubble = {
        id: `${Date.now()}-b`,
        from: 'bot',
        text: botText,
      };
      setMessages((prev) => [...prev, botBubble]);
    } catch {
      const fallback: ChatBubble = {
        id: `${Date.now()}-e`,
        from: 'bot',
        text: lang === 'zh-CN'
          ? '暂时无法发送消息，请稍后再试。'
          : 'Something went wrong. Please try again later.',
      };
      setMessages((prev) => [...prev, fallback]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-8">
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
        {i18n.language.startsWith('zh') ? (
          <>
            <p>这是匿名、非紧急的聊天体验，不会替代专业帮助。</p>
            <p className="mt-1">
              如果你有立即的安全风险（例如有强烈自伤或伤人冲动），请优先联系当地急救电话或心理热线。
            </p>
          </>
        ) : (
          <>
            <p>This is an anonymous, non-emergency chat experience. It does not replace professional help.</p>
            <p className="mt-1">
              If you are in immediate danger or crisis, please contact local emergency services or a crisis hotline first.
            </p>
          </>
        )}
      </div>

      <div
        ref={scrollRef}
        className="mt-4 flex min-h-[260px] flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
      >
        {messages.length === 0 && (
          <p className="text-xs text-slate-400">
            {i18n.language.startsWith('zh')
              ? '可以从一句简单的感受开始，比如 “最近老是睡不着”。'
              : 'You can start with a short sentence about how you feel, like “I’ve been tired but can’t sleep.”'}
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
              m.from === 'user'
                ? 'ml-auto bg-sky-500 text-slate-950'
                : 'mr-auto bg-slate-800 text-slate-100'
            }`}
          >
            {m.text.split('\n').map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          className="flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-900/60 p-2 text-sm text-slate-100 outline-none focus:border-sky-400"
          placeholder={
            i18n.language.startsWith('zh')
              ? '想聊点什么？'
              : 'What would you like to share?'
          }
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={loading || !sessionId}
          className="rounded-full bg-sky-400 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-40"
        >
          {loading
            ? i18n.language.startsWith('zh')
              ? '发送中…'
              : 'Sending…'
            : i18n.language.startsWith('zh')
              ? '发送'
              : 'Send'}
        </button>
      </div>
    </div>
  );
}

