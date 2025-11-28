import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../api/baseUrl';

export type AdminRole = 'superadmin' | 'admin' | 'content_admin' | 'data_admin' | 'analyst';
export type AdminPermission =
  | 'admin.manage'
  | 'audit.view'
  | 'dimensions.write'
  | 'questions.write'
  | 'rules.write'
  | 'glowtypes.write'
  | 'prompts.write'
  | 'content.write'
  | 'stats.view'
  | 'results.view'
  | 'data.reset';

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  superadmin: [
    'admin.manage',
    'audit.view',
    'dimensions.write',
    'questions.write',
    'rules.write',
    'glowtypes.write',
    'prompts.write',
    'content.write',
    'stats.view',
    'results.view',
    'data.reset',
  ],
  admin: [
    'dimensions.write',
    'questions.write',
    'rules.write',
    'glowtypes.write',
    'prompts.write',
    'content.write',
    'stats.view',
    'results.view',
  ],
  content_admin: ['content.write', 'stats.view'],
  data_admin: [
    'dimensions.write',
    'questions.write',
    'rules.write',
    'glowtypes.write',
    'prompts.write',
    'stats.view',
    'results.view',
  ],
  analyst: ['stats.view', 'results.view', 'audit.view'],
};

export const roleHasPermission = (role: AdminRole | undefined, perm: AdminPermission) => {
  if (!role) return false;
  if (role === 'superadmin') return true;
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
};

export interface AdminUser {
  id: number;
  username: string;
  role: AdminRole;
  isActive?: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt?: string;
}

export interface AdminAuditLog {
  id: number;
  adminId: number;
  username: string;
  action: string;
  method: string;
  path: string;
  ip: string;
  statusCode: number;
  metadata?: any;
  createdAt: string;
}

// Enhanced stats types
export interface RegionStat {
  region: string;
  count: number;
}

export interface DeviceStat {
  deviceType: string;
  count: number;
}

export interface HourStat {
  hour: number;
  count: number;
}

export interface LangStat {
  language: string;
  count: number;
}

export interface ChatStats {
  totalSessions: number;
  totalMessages: number;
  avgMessages: number;
  avgDurationSecs: number;
  crisisSessions: number;
}

export interface EnhancedStats {
  quizByRegion: RegionStat[];
  quizByDevice: DeviceStat[];
  quizByHour: HourStat[];
  quizByLang: LangStat[];
  chatStats: ChatStats;
  chatByRegion: RegionStat[];
  chatByDevice: DeviceStat[];
  chatByHour: HourStat[];
}

// AI Prompt slot (fixed, cannot be deleted)
export interface PromptSlot {
  key: string;
  name: string;
  description: string;
  defaultContent: string;
  currentContent: string;
  isCustomized: boolean;
  isActive: boolean;
  id?: number;
}

// Import/Export types
export type ImportMode = 'merge' | 'replace';

export interface ImportError {
  index: number;
  id?: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  mode: ImportMode;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors?: ImportError[];
  warnings?: string[];
}

export interface QuestionImportItem {
  questionId: string;
  order: number;
  questionZh: string;
  questionEn: string;
  options: Array<{
    text: { en: string; zh: string };
    value: string;
    scores: Record<string, number>;
  }>;
  primaryDimensionId?: number;
}

export interface RuleImportItem {
  name: string;
  description?: string;
  conditions: {
    dimensions: Record<string, { min?: number; max?: number }>;
  };
  resultTypeCode: string;
  priority: number;
  isFallback: boolean;
}

export interface DimensionImportItem {
  key: string;
  nameZh: string;
  nameEn: string;
  positivePole: string;
  negativePole: string;
  description?: string;
  strongThreshold: number;
  mildThreshold: number;
  displayOrder: number;
}

const ADMIN_TOKEN_KEY = 'admin_token';
const ADMIN_USER_KEY = 'admin_user';

const storage = {
  get: (key: string) => {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  },
  set: (key: string, value: string) => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(key, value);
  },
  remove: (key: string) => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(key);
  },
};

export const useAdminAuth = () => {
  const [token, setToken] = useState<string | null>(() => storage.get(ADMIN_TOKEN_KEY));
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    const raw = storage.get(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(!!token);
  const [error, setError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<string | null>(null);

  const persistSession = (user: AdminUser, newToken: string) => {
    storage.set(ADMIN_TOKEN_KEY, newToken);
    storage.set(ADMIN_USER_KEY, JSON.stringify(user));
    setToken(newToken);
    setCurrentUser(user);
  };

  const logout = useCallback(() => {
    storage.remove(ADMIN_TOKEN_KEY);
    storage.remove(ADMIN_USER_KEY);
    setToken(null);
    setCurrentUser(null);
  }, []);

  const getAuthHeader = useCallback((): Record<string, string> => {
    const activeToken = storage.get(ADMIN_TOKEN_KEY);
    return activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!token) return null;
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/me`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      if (!res.ok) {
        logout();
        return null;
      }
      const data = (await res.json()) as AdminUser;
      persistSession(data, token);
      return data;
    } catch {
      return null;
    }
  }, [getAuthHeader, logout, token]);

  useEffect(() => {
    if (!token) {
      setInitializing(false);
      return;
    }
    fetchProfile().finally(() => setInitializing(false));
  }, [token, fetchProfile]);

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    setLockUntil(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        persistSession(data.user, data.token);
        return true;
      }
      if (res.status === 429 && data.unlockAt) {
        setLockUntil(data.unlockAt);
      }
      setError(data.error || 'Login failed');
      return false;
    } catch {
      setError('Connection error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = !!token && !!currentUser;

  return {
    isAuthenticated,
    loading,
    initializing,
    error,
    lockUntil,
    login,
    logout,
    getAuthHeader,
    currentUser,
    refreshProfile: fetchProfile,
  };
};

export const useAdminApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeader = useCallback((): Record<string, string> => {
    const token = storage.get(ADMIN_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const apiCall = useCallback(async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        ...options,
        headers: (() => {
          const baseHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          };
          if (options.headers) {
            Object.assign(baseHeaders, options.headers as Record<string, string>);
          }
          return baseHeaders as HeadersInit;
        })(),
      });
      if (res.status === 401) {
        storage.remove(ADMIN_TOKEN_KEY);
        storage.remove(ADMIN_USER_KEY);
        window.location.reload();
        return null;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'API Error');
      }
      return await res.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  // Dimensions (Trait Dimensions)
  const listDimensions = () => apiCall<any[]>('/admin/dimensions');
  const createDimension = (data: any) => apiCall('/admin/dimensions', { method: 'POST', body: JSON.stringify(data) });
  const updateDimension = (id: number, data: any) => apiCall(`/admin/dimensions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  const deleteDimension = (id: number) => apiCall(`/admin/dimensions/${id}`, { method: 'DELETE' });
  const importDimensions = (items: DimensionImportItem[], mode: ImportMode = 'merge') =>
    apiCall<ImportResult>('/admin/dimensions/import', { method: 'POST', body: JSON.stringify({ items, mode }) });
  const exportDimensions = () => apiCall<{ items: DimensionImportItem[]; count: number }>('/admin/dimensions/export');

  // Questions
  const listQuestions = () => apiCall<any[]>('/admin/questions');
  const createQuestion = (data: any) => apiCall('/admin/questions', { method: 'POST', body: JSON.stringify(data) });
  const updateQuestion = (id: number, data: any) => apiCall(`/admin/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  const deleteQuestion = (id: number) => apiCall(`/admin/questions/${id}`, { method: 'DELETE' });
  const importQuestions = (items: QuestionImportItem[], mode: ImportMode = 'merge') =>
    apiCall<ImportResult>('/admin/questions/import', { method: 'POST', body: JSON.stringify({ items, mode }) });

  // Glowtypes
  const listGlowtypes = () => apiCall<any[]>('/admin/glowtypes');
  const getGlowtype = (id: number) => apiCall<any>(`/admin/glowtypes/${id}`);
  const createGlowtype = (data: any) => apiCall('/admin/glowtypes', { method: 'POST', body: JSON.stringify(data) });
  const updateGlowtype = (id: number, data: any) => apiCall(`/admin/glowtypes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  const deleteGlowtype = (id: number) => apiCall(`/admin/glowtypes/${id}`, { method: 'DELETE' });

  // Glowtype I18N
  const createGlowtypeI18N = (data: any) => apiCall('/admin/glowtypes/i18n', { method: 'POST', body: JSON.stringify(data) });
  const updateGlowtypeI18N = (id: number, data: any) => apiCall(`/admin/glowtypes/i18n/${id}`, { method: 'PUT', body: JSON.stringify(data) });

  // Scoring Rules
  const listRules = () => apiCall<any[]>('/admin/rules');
  const createRule = (data: any) => apiCall('/admin/rules', { method: 'POST', body: JSON.stringify(data) });
  const updateRule = (id: number, data: any) => apiCall(`/admin/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  const deleteRule = (id: number) => apiCall(`/admin/rules/${id}`, { method: 'DELETE' });
  const importRules = (items: RuleImportItem[], mode: ImportMode = 'merge') =>
    apiCall<ImportResult>('/admin/rules/import', { method: 'POST', body: JSON.stringify({ items, mode }) });
  const exportRules = () => apiCall<{ items: RuleImportItem[]; count: number }>('/admin/rules/export');

  // Rule Debugging
  const debugRules = (dimensionScores: Record<string, number>) =>
    apiCall<any>('/admin/rules/debug', { method: 'POST', body: JSON.stringify({ dimensionScores }) });
  const validateRules = () => apiCall<{ warnings: string[] }>('/admin/rules/validate');

  // Prompts (fixed slots - can update/reset but not create/delete)
  const listPrompts = () => apiCall<PromptSlot[]>('/admin/prompts');
  const updatePrompt = (keyOrId: string | number, data: { content: string; isActive?: boolean }) =>
    apiCall(`/admin/prompts/${keyOrId}`, { method: 'PUT', body: JSON.stringify(data) });
  const resetPrompt = (key: string) =>
    apiCall<{ success: boolean; message: string }>(`/admin/prompts/${key}/reset`, { method: 'POST' });

  // Stats
  const getStatsOverview = () => apiCall<any>('/admin/stats/overview');
  const getDailyStats = (days?: number) => apiCall<any[]>(`/admin/stats/daily${days ? `?days=${days}` : ''}`);
  const getGlowtypeDistribution = () => apiCall<any[]>('/admin/stats/glowtypes');
  const getEnhancedStats = (days?: number) => apiCall<EnhancedStats>(`/admin/stats/enhanced${days ? `?days=${days}` : ''}`);

  // Quiz Results
  const listQuizResults = (params?: { limit?: number; typeCode?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.typeCode) query.set('type', params.typeCode);
    const qs = query.toString();
    return apiCall<any[]>(`/admin/results${qs ? `?${qs}` : ''}`);
  };

  // Admin accounts & audit
  const getCurrentAdmin = useCallback(() => apiCall<AdminUser>('/admin/me'), [apiCall]);
  const listAdmins = useCallback(() => apiCall<AdminUser[]>('/admin/users'), [apiCall]);
  const createAdmin = useCallback(
    (data: { username: string; password: string; role?: AdminRole }) =>
      apiCall<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    [apiCall],
  );
  const updateAdmin = useCallback(
    (id: number, data: { role?: AdminRole; isActive?: boolean }) =>
      apiCall<AdminUser>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    [apiCall],
  );
  const listAuditLogs = useCallback((limit = 200) => apiCall<AdminAuditLog[]>(`/admin/audit?limit=${limit}`), [apiCall]);

  return {
    loading,
    error,
    // Dimensions
    listDimensions,
    createDimension,
    updateDimension,
    deleteDimension,
    importDimensions,
    exportDimensions,
    // Questions
    listQuestions,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    importQuestions,
    // Glowtypes
    listGlowtypes,
    getGlowtype,
    createGlowtype,
    updateGlowtype,
    deleteGlowtype,
    // I18N
    createGlowtypeI18N,
    updateGlowtypeI18N,
    // Rules
    listRules,
    createRule,
    updateRule,
    deleteRule,
    importRules,
    exportRules,
    debugRules,
    validateRules,
    // Prompts
    listPrompts,
    updatePrompt,
    resetPrompt,
    // Stats
    getStatsOverview,
    getDailyStats,
    getGlowtypeDistribution,
    getEnhancedStats,
    // Results
    listQuizResults,
    // Glowpedia
    listChapters: () => apiCall<any[]>('/admin/chapters'),
    createChapter: (data: any) => apiCall('/admin/chapters', { method: 'POST', body: JSON.stringify(data) }),
    updateChapter: (id: number, data: any) => apiCall(`/admin/chapters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteChapter: (id: number) => apiCall(`/admin/chapters/${id}`, { method: 'DELETE' }),
    listGlowSticks: () => apiCall<any[]>('/admin/glowsticks'),
    createGlowStick: (data: any) => apiCall('/admin/glowsticks', { method: 'POST', body: JSON.stringify(data) }),
    updateGlowStick: (id: number, data: any) => apiCall(`/admin/glowsticks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteGlowStick: (id: number) => apiCall(`/admin/glowsticks/${id}`, { method: 'DELETE' }),
    // Reset to Defaults
    resetDimensions: () => apiCall<{ message: string }>('/admin/dimensions/reset', { method: 'POST' }),
    resetQuestions: () => apiCall<{ message: string }>('/admin/questions/reset', { method: 'POST' }),
    resetGlowtypes: () => apiCall<{ message: string }>('/admin/glowtypes/reset', { method: 'POST' }),
    resetRules: () => apiCall<{ message: string }>('/admin/rules/reset', { method: 'POST' }),
    resetAllPrompts: () => apiCall<{ message: string }>('/admin/prompts/reset-all', { method: 'POST' }),
    resetGlowpedia: () => apiCall<{ message: string }>('/admin/glowpedia/reset', { method: 'POST' }),
    // Admin
    getCurrentAdmin,
    listAdmins,
    createAdmin,
    updateAdmin,
    listAuditLogs,
  };
};
