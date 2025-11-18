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
      <div className="min-h-screen flex flex-col app-starfield text-slate-900">
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
