import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { ChatPage } from './pages/ChatPage';
import { HelpPage } from './pages/HelpPage';
import { SafetyPage } from './pages/SafetyPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-sky-200/70 blur-3xl" />
          <div className="absolute right-[-40px] top-32 h-80 w-80 rounded-full bg-fuchsia-200/60 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white via-slate-50/80 to-transparent" />
        </div>
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/result/:typeId" element={<ResultPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/safety" element={<SafetyPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
