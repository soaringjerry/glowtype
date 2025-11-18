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
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sky-300">
            {i18n.language.startsWith('zh')
              ? '匿名聊天 · 无需注册'
              : 'Anonymous chat · no account'}
          </p>
          <p className="mt-1 text-sm text-slate-200">
            {i18n.language.startsWith('zh')
              ? '这里更像一个可以试着说说心里话的小树洞。'
              : 'A small space to try putting feelings into words.'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {i18n.language.startsWith('zh')
              ? '不是专业咨询，如果你觉得自己处在危险中，请优先联系身边的大人或紧急热线。'
              : 'This is not therapy. If you feel unsafe, please reach out to a trusted adult or local hotline first.'}
          </p>
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-fuchsia-400 text-xs text-slate-950 shadow-[0_0_18px_rgba(56,189,248,0.7)]">
          💬
        </span>
      </div>

      <div
        ref={scrollRef}
        className="mt-4 flex min-h-[260px] flex-1 flex-col gap-3 overflow-y-auto rounded-3xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-[0_0_32px_rgba(15,23,42,0.9)]"
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
            className={`max-w-[80%] rounded-3xl px-3 py-2 text-xs leading-relaxed ${
              m.from === 'user'
                ? 'ml-auto bg-sky-500 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.7)]'
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
          className="flex-1 resize-none rounded-3xl border border-slate-700 bg-slate-900/60 p-2 text-sm text-slate-100 outline-none focus:border-sky-400"
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
          className="rounded-full bg-sky-400 px-4 py-2 text-sm font-medium text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.6)] transition hover:bg-sky-300 hover:shadow-[0_0_26px_rgba(125,211,252,0.7)] active:scale-95 disabled:opacity-40"
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
