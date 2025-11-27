import { useState, useEffect, useMemo } from 'react';
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
  Globe,
  BarChart3,
  Shield,
  ScrollText,
  Loader2
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
import Results from './pages/Results';
import Glowpedia from './pages/Glowpedia';
import AdminUsers from './pages/AdminUsers';
import AuditLogs from './pages/AuditLogs';

export default function AdminLayout() {
  const { t, i18n } = useTranslation('admin');
  const { isAuthenticated, initializing, currentUser, logout } = useAdminAuth();
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

  const navItems = useMemo(() => {
    const base = [
      { path: '/admin', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { path: '/admin/dimensions', labelKey: 'nav.dimensions', icon: Compass },
      { path: '/admin/questions', labelKey: 'nav.questions', icon: HelpCircle },
      { path: '/admin/glowtypes', labelKey: 'nav.glowtypes', icon: Sparkles },
      { path: '/admin/rules', labelKey: 'nav.rules', icon: Settings2 },
      { path: '/admin/debugger', labelKey: 'nav.debugger', icon: Bug },
      { path: '/admin/results', labelKey: 'nav.results', icon: BarChart3 },
      { path: '/admin/prompts', labelKey: 'nav.prompts', icon: MessageSquare },
      { path: '/admin/glowpedia', labelKey: 'nav.glowpedia', icon: Sparkles },
    ];
    if (currentUser?.role === 'superadmin') {
      base.splice(1, 0, { path: '/admin/users', labelKey: 'nav.adminUsers', icon: Shield });
      base.splice(base.length, 0, { path: '/admin/audit', labelKey: 'nav.audit', icon: ScrollText });
    }
    return base;
  }, [currentUser]);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          {t('common.loading')}
        </div>
      </div>
    );
  }

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
            title={i18n.language === 'zh-CN' ? t('common.switchToEnglish') : t('common.switchToChinese')}
          >
            <Globe className="w-5 h-5" />
          </button>
        </div>
        {currentUser && (
          <div className="px-6 pt-3 pb-2 text-xs text-gray-500">
            <div className="font-medium text-gray-800">{currentUser.username}</div>
            <div>{currentUser.role === 'superadmin' ? t('roles.superadmin') : t('roles.admin')}</div>
          </div>
        )}

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
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/dimensions" element={<Dimensions />} />
            <Route path="/admin/questions" element={<Questions />} />
            <Route path="/admin/glowtypes" element={<Glowtypes />} />
            <Route path="/admin/rules" element={<Rules />} />
            <Route path="/admin/debugger" element={<RuleDebugger />} />
            <Route path="/admin/results" element={<Results />} />
            <Route path="/admin/prompts" element={<Prompts />} />
            <Route path="/admin/glowpedia" element={<Glowpedia />} />
            <Route path="/admin/audit" element={<AuditLogs />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
