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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="mt-2 text-xs text-slate-400">
        {t('progress', { current: currentIndex + 1, total })}
      </p>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-base font-medium">{currentQuestion.question}</p>
        <div className="mt-4 flex flex-col gap-3">
          {currentQuestion.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleChoose(currentQuestion.id, opt.id)}
              className={`rounded-xl border px-4 py-2 text-left text-sm transition ${
                selected === opt.id
                  ? 'border-sky-400 bg-sky-400/10'
                  : 'border-slate-700 hover:border-sky-300'
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
          className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 disabled:opacity-40"
        >
          {t('previous')}
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="rounded-full bg-sky-400 px-4 py-2 text-slate-900"
        >
          {currentIndex === total - 1 ? t('submit') : t('next')}
        </button>
      </div>
    </div>
  );
}

