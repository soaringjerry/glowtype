import { useCallback, useState } from 'react';
import { getApiBaseUrl } from '../../api/baseUrl';

export const useAdminAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('admin_token');
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
        return true;
      } else {
        setError(data.error || 'Login failed');
        return false;
      }
    } catch {
      setError('Connection error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  return { isAuthenticated, loading, error, login, logout, getAuthHeader };
};

export const useAdminApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeader = () => {
    const token = localStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const apiCall = useCallback(async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
          ...(options.headers as Record<string, string> || {}),
        } as HeadersInit,
      });
      if (res.status === 401) {
        localStorage.removeItem('admin_token');
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
  }, []);

  // Dimensions (Trait Dimensions)
  const listDimensions = () => apiCall<any[]>('/admin/dimensions');
  const createDimension = (data: any) => apiCall('/admin/dimensions', { method: 'POST', body: JSON.stringify(data) });
  const updateDimension = (id: number, data: any) => apiCall(`/admin/dimensions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  const deleteDimension = (id: number) => apiCall(`/admin/dimensions/${id}`, { method: 'DELETE' });

  // Questions
  const listQuestions = () => apiCall<any[]>('/admin/questions');
  const createQuestion = (data: any) => apiCall('/admin/questions', { method: 'POST', body: JSON.stringify(data) });
  const updateQuestion = (id: number, data: any) => apiCall(`/admin/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  const deleteQuestion = (id: number) => apiCall(`/admin/questions/${id}`, { method: 'DELETE' });

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

  // Rule Debugging
  const debugRules = (dimensionScores: Record<string, number>) =>
    apiCall<any>('/admin/rules/debug', { method: 'POST', body: JSON.stringify({ dimensionScores }) });
  const validateRules = () => apiCall<{ warnings: string[] }>('/admin/rules/validate');

  // Prompts
  const listPrompts = () => apiCall<any[]>('/admin/prompts');
  const createPrompt = (data: any) => apiCall('/admin/prompts', { method: 'POST', body: JSON.stringify(data) });
  const updatePrompt = (id: number, data: any) => apiCall(`/admin/prompts/${id}`, { method: 'PUT', body: JSON.stringify(data) });

  // Stats
  const getStatsOverview = () => apiCall<any>('/admin/stats/overview');
  const getDailyStats = (days?: number) => apiCall<any[]>(`/admin/stats/daily${days ? `?days=${days}` : ''}`);
  const getGlowtypeDistribution = () => apiCall<any[]>('/admin/stats/glowtypes');

  // Quiz Results
  const listQuizResults = (params?: { limit?: number; typeCode?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.typeCode) query.set('type', params.typeCode);
    const qs = query.toString();
    return apiCall<any[]>(`/admin/results${qs ? `?${qs}` : ''}`);
  };

  return {
    loading,
    error,
    // Dimensions
    listDimensions,
    createDimension,
    updateDimension,
    deleteDimension,
    // Questions
    listQuestions,
    createQuestion,
    updateQuestion,
    deleteQuestion,
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
    debugRules,
    validateRules,
    // Prompts
    listPrompts,
    createPrompt,
    updatePrompt,
    // Stats
    getStatsOverview,
    getDailyStats,
    getGlowtypeDistribution,
    // Results
    listQuizResults,
  };
};
