import { useState, useEffect, useMemo, type ReactNode } from 'react';
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
  Settings,
  Bug,
  Globe,
  BarChart3,
  Shield,
  ScrollText,
  Eye,
  Loader2,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { isReadOnlyRole, userHasPermission, useAdminAuth } from './hooks/useAdmin';
import type { AdminPermission } from './hooks/useAdmin';
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
import Analytics from './pages/Analytics';
import AISettings from './pages/AISettings';
import AdminSettings from './pages/AdminSettings';

export default function AdminLayout() {
  const { t, i18n } = useTranslation('admin');
  const { isAuthenticated, initializing, currentUser, logout, needs2FASetup } = useAdminAuth();
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

  useEffect(() => {
    if (needs2FASetup && location.pathname !== '/admin/settings') {
      navigate('/admin/settings', { replace: true });
    }
  }, [needs2FASetup, location.pathname, navigate]);

  const navItems = useMemo(() => {
    if (needs2FASetup) {
      return [];
    }

    const items: Array<{ path: string; labelKey: string; icon: any; perm: AdminPermission }> = [
      { path: '/admin', labelKey: 'nav.dashboard', icon: LayoutDashboard, perm: 'stats.view' },
      { path: '/admin/analytics', labelKey: 'nav.analytics', icon: TrendingUp, perm: 'stats.view' },
      { path: '/admin/users', labelKey: 'nav.adminUsers', icon: Shield, perm: 'admin.manage' },
      { path: '/admin/dimensions', labelKey: 'nav.dimensions', icon: Compass, perm: 'dimensions.write' },
      { path: '/admin/questions', labelKey: 'nav.questions', icon: HelpCircle, perm: 'questions.write' },
      { path: '/admin/glowtypes', labelKey: 'nav.glowtypes', icon: Sparkles, perm: 'glowtypes.write' },
      { path: '/admin/rules', labelKey: 'nav.rules', icon: Settings2, perm: 'rules.write' },
      { path: '/admin/debugger', labelKey: 'nav.debugger', icon: Bug, perm: 'rules.write' },
      { path: '/admin/results', labelKey: 'nav.results', icon: BarChart3, perm: 'results.view' },
      { path: '/admin/prompts', labelKey: 'nav.prompts', icon: MessageSquare, perm: 'prompts.write' },
      { path: '/admin/glowpedia', labelKey: 'nav.glowpedia', icon: Sparkles, perm: 'content.write' },
      { path: '/admin/audit', labelKey: 'nav.audit', icon: ScrollText, perm: 'audit.view' },
    ];
    // Filter by permission, then add superadmin-only items
    const filtered = items.filter((item) => userHasPermission(currentUser, item.perm));
    // AI Settings is superadmin-only (no permission, just role check)
    if (currentUser?.role === 'superadmin') {
      // Insert after prompts
      const promptsIdx = filtered.findIndex((item) => item.path === '/admin/prompts');
      filtered.splice(promptsIdx + 1, 0, {
        path: '/admin/ai-settings',
        labelKey: 'nav.aiSettings',
        icon: Cpu,
        perm: 'admin.manage' as AdminPermission, // Just for type, not used for filtering
      });
    }
    return filtered;
  }, [currentUser, needs2FASetup]);

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

  const readOnly = isReadOnlyRole(currentUser?.role);

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {needs2FASetup && (
        <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 px-4 py-3 text-sm flex items-center justify-between">
          <span>{t('twoFactor.requiredNotice', '已被要求启用两步验证，请先在“个人设置”完成绑定后继续使用后台。')}</span>
          <button
            onClick={() => navigate('/admin/settings')}
            className="text-yellow-900 font-medium underline"
          >
            {t('nav.settings', '个人设置')}
          </button>
        </div>
      )}
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
            <div>{t(`roles.${currentUser.role}`)}</div>
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

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 space-y-1">
          <button
            onClick={() => navigate('/admin/settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
              location.pathname === '/admin/settings'
                ? 'bg-purple-50 text-purple-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">{t('nav.settings', '个人设置')}</span>
          </button>
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
          {readOnly && (
            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Eye className="w-4 h-4" />
              <div>
                <div className="font-semibold text-sm">{t('common.readOnlyMode')}</div>
                <div className="text-xs">{t('common.readOnlyHint')}</div>
              </div>
            </div>
          )}
          <Routes>
            <Route path="/admin" element={<Protected perm="stats.view"><Dashboard /></Protected>} />
            <Route path="/admin/analytics" element={<Protected perm="stats.view"><Analytics /></Protected>} />
            <Route path="/admin/users" element={<Protected perm="admin.manage"><AdminUsers /></Protected>} />
            <Route path="/admin/dimensions" element={<Protected perm="dimensions.write"><Dimensions /></Protected>} />
            <Route path="/admin/questions" element={<Protected perm="questions.write"><Questions /></Protected>} />
            <Route path="/admin/glowtypes" element={<Protected perm="glowtypes.write"><Glowtypes /></Protected>} />
            <Route path="/admin/rules" element={<Protected perm="rules.write"><Rules /></Protected>} />
            <Route path="/admin/debugger" element={<Protected perm="rules.write"><RuleDebugger /></Protected>} />
            <Route path="/admin/results" element={<Protected perm="results.view"><Results /></Protected>} />
            <Route path="/admin/prompts" element={<Protected perm="prompts.write"><Prompts /></Protected>} />
            <Route path="/admin/ai-settings" element={<SuperadminOnly><AISettings /></SuperadminOnly>} />
            <Route path="/admin/glowpedia" element={<Protected perm="content.write"><Glowpedia /></Protected>} />
            <Route path="/admin/audit" element={<Protected perm="audit.view"><AuditLogs /></Protected>} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

type ProtectedProps = {
  perm: AdminPermission;
  children: ReactNode;
};

function Protected({ perm, children }: ProtectedProps) {
  const { t } = useTranslation('admin');
  const { currentUser } = useAdminAuth();
  if (!userHasPermission(currentUser, perm)) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-amber-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">{t('accessDenied.title')}</h2>
        <p className="text-sm text-gray-600">{t('accessDenied.desc')}</p>
      </div>
    );
  }
  return <>{children}</>;
}

function SuperadminOnly({ children }: { children: ReactNode }) {
  const { t } = useTranslation('admin');
  const { currentUser } = useAdminAuth();
  if (currentUser?.role !== 'superadmin') {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-amber-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">{t('accessDenied.title')}</h2>
        <p className="text-sm text-gray-600">{t('accessDenied.superadminOnly', 'This feature requires superadmin access.')}</p>
      </div>
    );
  }
  return <>{children}</>;
}
