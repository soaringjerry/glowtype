import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './en/common.json';
import enHome from './en/home.json';
import enQuiz from './en/quiz.json';
import enResult from './en/result.json';
import enHelp from './en/help.json';
import enAdmin from './en/admin.json';

import zhCommon from './zh-CN/common.json';
import zhHome from './zh-CN/home.json';
import zhQuiz from './zh-CN/quiz.json';
import zhResult from './zh-CN/result.json';
import zhHelp from './zh-CN/help.json';
import zhAdmin from './zh-CN/admin.json';

export const defaultNS = 'common';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh-CN'],
    ns: ['common', 'home', 'quiz', 'result', 'help', 'admin'],
    defaultNS,
    resources: {
      en: {
        common: enCommon,
        home: enHome,
        quiz: enQuiz,
        result: enResult,
        help: enHelp,
        admin: enAdmin,
      },
      'zh-CN': {
        common: zhCommon,
        home: zhHome,
        quiz: zhQuiz,
        result: zhResult,
        help: zhHelp,
        admin: zhAdmin,
      },
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'glowtype-lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

