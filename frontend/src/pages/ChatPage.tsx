/**
 * @deprecated 此页面已废弃，未被使用
 * 应用使用 App.tsx 中的 ChatView 组件
 * This page is deprecated and not in use.
 * The app uses ChatView in App.tsx instead.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, Heart, Sparkles } from 'lucide-react';
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const isZh = i18n.language.startsWith('zh');

  useEffect(() => {
    const lang = isZh ? 'zh-CN' : 'en';
    apiPost<ChatSessionResponse, { language: string }>('/chat/session', { language: lang })
      .then((res) => setSessionId(res.sessionId))
      .catch(() => setSessionId(null));
  }, [isZh]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !sessionId || loading) return;
    const lang = isZh ? 'zh-CN' : 'en';

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
        text: isZh
          ? '暂时无法发送消息，请稍后再试。'
          : 'Something went wrong. Please try again later.',
      };
      setMessages((prev) => [...prev, fallback]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col bg-gradient-to-b from-slate-50 to-white">
      {/* Header - Fixed at top */}
      <header className="flex-none border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-400 shadow-[0_0_16px_rgba(56,189,248,0.4)]">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-slate-900">
                  {isZh ? '匿名树洞' : 'Anonymous Chat'}
                </h1>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-slate-400">
                    {isZh ? '在线' : 'Online'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Link
            to="/help"
            className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-100"
          >
            <Heart size={12} />
            <span className="hidden sm:inline">{isZh ? '危机支持' : 'Crisis Help'}</span>
          </Link>
        </div>
      </header>

      {/* Chat Info Banner */}
      <div className="flex-none border-b border-slate-100 bg-sky-50/50 px-4 py-2">
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-[11px] text-slate-500">
            {isZh
              ? '不是专业咨询。如果你处在危险中，请联系身边的大人或紧急热线。'
              : 'Not professional advice. If unsafe, please contact a trusted adult or crisis hotline.'}
          </p>
        </div>
      </div>

      {/* Messages Area - Scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {/* Welcome message */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-fuchsia-100">
                <Sparkles size={24} className="text-sky-500" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">
                  {isZh ? '这里是你的小树洞' : 'Your safe space to share'}
                </p>
                <p className="max-w-xs text-xs text-slate-400">
                  {isZh
                    ? '可以从一句简单的感受开始，比如 "最近老是睡不着"'
                    : 'Start with something simple, like "I\'ve been feeling tired but can\'t sleep"'}
                </p>
              </div>
            </div>
          )}

          {/* Chat bubbles */}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.from === 'user'
                    ? 'rounded-br-md bg-sky-500 text-white shadow-[0_4px_12px_rgba(56,189,248,0.3)]'
                    : 'rounded-bl-md border border-slate-100 bg-white text-slate-700 shadow-sm'
                }`}
              >
                {m.text.split('\n').map((line, idx) => (
                  <p key={idx} className={idx > 0 ? 'mt-1' : ''}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-none border-t border-slate-100 bg-white/90 p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={!sessionId}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-50"
              placeholder={isZh ? '想聊点什么...' : 'What would you like to share...'}
              style={{ maxHeight: '120px' }}
            />
          </div>
          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !sessionId || !input.trim()}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-sky-500 text-white shadow-[0_4px_12px_rgba(56,189,248,0.4)] transition hover:bg-sky-400 hover:shadow-[0_4px_16px_rgba(56,189,248,0.5)] active:scale-95 disabled:opacity-40 disabled:shadow-none"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-slate-300">
          {isZh ? 'AI 可能出错 · 隐私保护 · 按 Enter 发送' : 'AI may make mistakes · Private · Press Enter to send'}
        </p>
      </div>
    </div>
  );
}
