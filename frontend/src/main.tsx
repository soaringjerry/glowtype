import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import './i18n';

// Layouts
import { MainLayout } from './components/MainLayout';
import AdminLayout from './admin/AdminLayout';

// Pages
import { HomePage } from './pages/HomePage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { ChatPage } from './pages/ChatPage';
import { HelpPage } from './pages/HelpPage';
import { SafetyPage } from './pages/SafetyPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import ShareRenderPage from './pages/ShareRenderPage';

// Legacy App for fallback
import App from './App.tsx';

const router = createBrowserRouter([
  // Main public routes with layout
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'quiz', element: <QuizPage /> },
      { path: 'result/:typeId', element: <ResultPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: 'safety', element: <SafetyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
    ],
  },
  // Share render (no layout - for screenshot generation)
  { path: '/share-render', element: <ShareRenderPage /> },
  // Admin routes
  { path: '/admin/*', element: <AdminLayout /> },
  // Legacy app route (for old flow)
  { path: '/legacy', element: <App /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
