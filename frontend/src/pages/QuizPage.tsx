import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../api/client';

type QuizQuestion = {
  id: string;
  order: number;
  question: string;
  options: { id: string; text: string }[];
};

type QuizResponse = {
  quizId: string;
  language: string;
  questions: QuizQuestion[];
};

type QuizScoreResponse = {
  glowtypeId: string;
};

export function QuizPage() {
  const { t, i18n } = useTranslation('quiz');
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const lang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en';
    setLoading(true);
    apiGet<QuizResponse>(`/quiz?lang=${encodeURIComponent(lang)}`)
      .then((data) => {
        setQuiz(data);
        setError(null);
      })
      .catch(() => setError('load'))
      .finally(() => setLoading(false));
  }, [i18n.language]);

  const currentQuestion = quiz?.questions[currentIndex];

  const handleChoose = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleNext = () => {
    if (!quiz) return;
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // submit
      const payload = {
        quizId: quiz.quizId,
        language: quiz.language,
        answers: Object.entries(answers).map(([questionId, optionId]) => ({
          questionId,
          optionId,
        })),
      };
      apiPost<QuizScoreResponse>('/quiz/score', payload)
        .then((res) => {
          navigate(`/result/${encodeURIComponent(res.glowtypeId)}`);
        })
        .catch(() => {
          setError('score');
        });
    }
  };

  const handlePrev = () => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-300">
        {t('loading')}
      </div>
    );
  }

  if (!quiz || error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-300">
        {t('error')}
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const total = quiz.questions.length;
  const selected = answers[currentQuestion.id];
  const progressFraction = total > 0 ? (currentIndex + 1) / total : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold text-slate-950">{t('title')}</h1>
      <p className="mt-1 text-xs text-slate-500">
        {t('progress', { current: currentIndex + 1, total })}
      </p>
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-sky-400 transition-[width]"
          style={{ width: `${Math.max(5, progressFraction * 100)}%` }}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-xs uppercase tracking-[0.2em] text-sky-500">
          {t('questionLabel', { index: currentIndex + 1 })}
        </p>
        <p className="mt-2 text-base font-medium text-slate-900">
          {currentQuestion.question}
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {currentQuestion.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleChoose(currentQuestion.id, opt.id)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-transform ${
                selected === opt.id
                  ? 'border-sky-400 bg-sky-50 shadow-[0_18px_45px_rgba(56,189,248,0.25)]'
                  : 'border-slate-200 bg-white/80 hover:border-sky-300/80 hover:bg-sky-50/80 hover:shadow-[0_18px_40px_rgba(56,189,248,0.2)]'
              }`}
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="rounded-full border border-slate-700/90 px-4 py-2 text-slate-200 transition active:scale-95 disabled:opacity-40"
        >
          {t('previous')}
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="rounded-full bg-sky-400 px-5 py-2 text-slate-950 shadow-[0_0_24px_rgba(56,189,248,0.5)] transition hover:bg-sky-300 hover:shadow-[0_0_32px_rgba(125,211,252,0.7)] active:scale-95"
        >
          {currentIndex === total - 1 ? t('submit') : t('next')}
        </button>
      </div>
    </div>
  );
}
