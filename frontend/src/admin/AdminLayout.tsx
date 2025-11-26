import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  HelpCircle,
  Sparkles,
  MessageSquare,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Compass,
  Settings2,
  Bug,
  Globe
} from 'lucide-react';
import { useAdminAuth } from './hooks/useAdmin';
import AdminLogin from './AdminLogin';
import Dashboard from './pages/Dashboard';
import Dimensions from './pages/Dimensions';
import Questions from './pages/Questions';
import Glowtypes from './pages/Glowtypes';
import Rules from './pages/Rules';
import RuleDebugger from './pages/RuleDebugger';
import Prompts from './pages/Prompts';

const navItems = [
  { path: '/admin', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/admin/dimensions', labelKey: 'nav.dimensions', icon: Compass },
  { path: '/admin/questions', labelKey: 'nav.questions', icon: HelpCircle },
  { path: '/admin/glowtypes', labelKey: 'nav.glowtypes', icon: Sparkles },
  { path: '/admin/rules', labelKey: 'nav.rules', icon: Settings2 },
  { path: '/admin/debugger', labelKey: 'nav.debugger', icon: Bug },
  { path: '/admin/prompts', labelKey: 'nav.prompts', icon: MessageSquare },
];

export default function AdminLayout() {
  const { t, i18n } = useTranslation('admin');
  const { isAuthenticated, logout } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh-CN' ? 'en' : 'zh-CN';
    i18n.changeLanguage(newLang);
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => window.location.reload()} />;
  }

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center px-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <span className="ml-4 font-semibold text-gray-800">{t('title')}</span>
      </div>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <button
            onClick={toggleLanguage}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            title={i18n.language === 'zh-CN' ? 'Switch to English' : '切换到中文'}
          >
            <Globe className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  isActive
                    ? 'bg-purple-50 text-purple-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{t(item.labelKey)}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6">
          <Routes>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/dimensions" element={<Dimensions />} />
            <Route path="/admin/questions" element={<Questions />} />
            <Route path="/admin/glowtypes" element={<Glowtypes />} />
            <Route path="/admin/rules" element={<Rules />} />
            <Route path="/admin/debugger" element={<RuleDebugger />} />
            <Route path="/admin/prompts" element={<Prompts />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
