import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import { getApiBaseUrl } from '../../../api/baseUrl';
import type { AnalyticsResponse } from '../../hooks/useAdmin';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Suggestion {
  type: string;
  label: string;
  action: string;
}

interface AnalyticsChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  analyticsData: AnalyticsResponse | null;
  initialQuestion?: string;
  currentView?: string;
  onAction?: (action: string) => void;
}

export default function AnalyticsChatPanel({
  isOpen,
  onClose,
  analyticsData,
  initialQuestion,
  currentView = 'overview',
  onAction,
}: AnalyticsChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialQuestionSentRef = useRef(false);

  // Detect language
  const isZh = typeof navigator !== 'undefined' && navigator.language.startsWith('zh');

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle initial question from [?] button
  useEffect(() => {
    if (isOpen && initialQuestion && messages.length === 0 && !initialQuestionSentRef.current) {
      initialQuestionSentRef.current = true;
      // Trigger send after a short delay to ensure component is ready
      const timer = setTimeout(() => {
        const userMessage: ChatMessage = { role: 'user', content: initialQuestion };
        setMessages([userMessage]);
        setLoading(true);

        const token = localStorage.getItem('adminToken');
        fetch(`${getApiBaseUrl()}/admin/analytics/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [userMessage],
            context: {
              currentView,
              analyticsData: analyticsData ? {
                summary: analyticsData.summary,
                reliability: {
                  cronbachAlpha: analyticsData.reliability.cronbachAlpha,
                  spearmanBrown: analyticsData.reliability.spearmanBrown,
                  sampleSize: analyticsData.reliability.sampleSize,
                  hasSufficientSample: analyticsData.reliability.hasSufficientSample,
                  itemTotalCorrelations: analyticsData.reliability.itemTotalCorrelations,
                },
                dimensionStats: Object.fromEntries(
                  Object.entries(analyticsData.dimensionStats).map(([k, v]) => [
                    k,
                    { mean: v.mean, stdDev: v.stdDev, min: v.min, max: v.max, median: v.median },
                  ])
                ),
              } : null,
              language: isZh ? 'zh-CN' : 'en',
            },
          }),
        })
          .then(res => res.json())
          .then(data => {
            setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
            if (data.suggestions?.length > 0) {
              setSuggestions(data.suggestions);
            }
          })
          .catch(() => {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: isZh ? '抱歉，获取回复时出现错误。请稍后再试。' : 'Sorry, there was an error getting a response. Please try again.'
            }]);
          })
          .finally(() => setLoading(false));
      }, 100);
      return () => clearTimeout(timer);
    }
    // Reset ref when panel closes
    if (!isOpen) {
      initialQuestionSentRef.current = false;
    }
  }, [isOpen, initialQuestion, messages.length, currentView, analyticsData, isZh]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setSuggestions([]);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${getApiBaseUrl()}/admin/analytics/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context: {
            currentView,
            analyticsData: analyticsData ? prepareDataForAI(analyticsData) : null,
            language: isZh ? 'zh-CN' : 'en',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = { role: 'assistant', content: data.content };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: isZh
          ? '抱歉，获取回复时出现错误。请稍后再试。'
          : 'Sorry, there was an error getting a response. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = async (questionType: string) => {
    if (loading) return;

    setLoading(true);
    setSuggestions([]);

    // Add placeholder user message
    const placeholderQuestions: Record<string, { zh: string; en: string }> = {
      reliability: { zh: '分析信度指标', en: 'Analyze reliability metrics' },
      dimension: { zh: '分析维度分布', en: 'Analyze dimension distributions' },
      correlation: { zh: '解读相关矩阵', en: 'Interpret correlation matrix' },
      trend: { zh: '分析数据趋势', en: 'Analyze data trends' },
      improvement: { zh: '给出改进建议', en: 'Suggest improvements' },
    };

    const userMessage: ChatMessage = {
      role: 'user',
      content: isZh
        ? placeholderQuestions[questionType]?.zh || questionType
        : placeholderQuestions[questionType]?.en || questionType,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${getApiBaseUrl()}/admin/analytics/quick-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionType,
          analyticsData: analyticsData ? prepareDataForAI(analyticsData) : null,
          language: isZh ? 'zh-CN' : 'en',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = { role: 'assistant', content: data.content };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: isZh
          ? '抱歉，获取回复时出现错误。请稍后再试。'
          : 'Sorry, there was an error getting a response. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (onAction) {
      onAction(suggestion.action);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Prepare analytics data for AI (remove unnecessary fields to save tokens)
  const prepareDataForAI = (data: AnalyticsResponse) => {
    return {
      summary: data.summary,
      reliability: {
        cronbachAlpha: data.reliability.cronbachAlpha,
        spearmanBrown: data.reliability.spearmanBrown,
        sampleSize: data.reliability.sampleSize,
        hasSufficientSample: data.reliability.hasSufficientSample,
        itemTotalCorrelations: data.reliability.itemTotalCorrelations,
      },
      dimensionStats: Object.fromEntries(
        Object.entries(data.dimensionStats).map(([k, v]) => [
          k,
          { mean: v.mean, stdDev: v.stdDev, min: v.min, max: v.max, median: v.median },
        ])
      ),
      segments: {
        topRegions: data.segments?.byRegion?.slice(0, 5),
        devices: data.segments?.byDevice,
      },
      trends: {
        recentDays: data.trends?.daily?.slice(-7),
      },
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">
              {isZh ? 'AI 数据分析助手' : 'AI Analytics Assistant'}
            </h3>
            <p className="text-xs text-gray-500">
              {isZh ? '帮你理解统计数据' : 'Helps you understand the data'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Quick Questions */}
      {messages.length === 0 && (
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">
            {isZh ? '快捷问题' : 'Quick Questions'}
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'reliability', zh: '信度分析', en: 'Reliability' },
              { key: 'dimension', zh: '维度分布', en: 'Dimensions' },
              { key: 'improvement', zh: '改进建议', en: 'Improvements' },
            ].map((q) => (
              <button
                key={q.key}
                onClick={() => handleQuickQuestion(q.key)}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 transition-all disabled:opacity-50"
              >
                <HelpCircle className="w-3 h-3 inline mr-1" />
                {isZh ? q.zh : q.en}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 mx-auto text-purple-300 mb-4" />
            <p className="text-gray-500 text-sm">
              {isZh
                ? '你可以问我任何关于数据分析的问题'
                : 'Ask me anything about your analytics data'}
            </p>
            <p className="text-gray-400 text-xs mt-2">
              {isZh
                ? '例如："Cronbach\'s Alpha 0.82 代表什么？"'
                : 'e.g., "What does Cronbach\'s Alpha 0.82 mean?"'}
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-full hover:bg-purple-100 transition-colors"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isZh ? '输入你的问题...' : 'Type your question...'}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
