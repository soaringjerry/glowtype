import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../api/baseUrl';

export type AdminRole = 'superadmin' | 'admin' | 'content_admin' | 'data_admin' | 'analyst' | 'crisis_admin' | 'viewer';
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
  | 'data.reset'
  | 'crisis.manage';

// All available permissions for UI
export const ALL_PERMISSIONS: AdminPermission[] = [
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
  'crisis.manage',
];

// Permission display names for UI
export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  'admin.manage': '管理员管理',
  'audit.view': '审计日志',
  'dimensions.write': '维度管理',
  'questions.write': '题目管理',
  'rules.write': '规则管理',
  'glowtypes.write': 'Glowtype管理',
  'prompts.write': 'AI提示词管理',
  'content.write': '内容管理',
  'stats.view': '统计查看',
  'results.view': '结果查看',
  'data.reset': '数据重置',
  'crisis.manage': '危机配置管理',
};

// Role display names
export const ROLE_LABELS: Record<AdminRole, string> = {
  superadmin: '超级管理员',
  admin: '管理员',
  content_admin: '内容管理员',
  data_admin: '数据管理员',
  analyst: '分析师',
  crisis_admin: '危机干预管理员',
  viewer: '只读用户',
};

// Default role permission templates (for reference, actual checking uses effectivePermissions)
const ROLE_PERMISSION_TEMPLATES: Record<AdminRole, AdminPermission[]> = {
  superadmin: [...ALL_PERMISSIONS],
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
  // Crisis Admin: can manage all crisis config but NO import/export/reset
  crisis_admin: [
    'crisis.manage',
    'prompts.write',
    'stats.view',
  ],
  // Viewer: read-only, NO admin.manage, NO audit.view
  viewer: [
    'dimensions.write',
    'questions.write',
    'rules.write',
    'glowtypes.write',
    'prompts.write',
    'content.write',
    'stats.view',
    'results.view',
  ],
};

// Get default permissions for a role (used when creating new admin)
export const getRoleDefaultPermissions = (role: AdminRole): AdminPermission[] => {
  return ROLE_PERMISSION_TEMPLATES[role] ?? [];
};

// Check permission using effectivePermissions from user object
export const userHasPermission = (
  user: AdminUser | null | undefined,
  perm: AdminPermission
): boolean => {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  // Use effectivePermissions if available (from API), fallback to role template
  const perms = user.effectivePermissions ?? ROLE_PERMISSION_TEMPLATES[user.role] ?? [];
  return perms.includes(perm);
};

// Legacy function for backward compatibility (uses role template only)
export const roleHasPermission = (role: AdminRole | undefined, perm: AdminPermission) => {
  if (!role) return false;
  if (role === 'superadmin') return true;
  return ROLE_PERMISSION_TEMPLATES[role]?.includes(perm) ?? false;
};

export const isReadOnlyRole = (role: AdminRole | undefined) => role === 'viewer';

export interface AdminUser {
  id: number;
  username: string;
  role: AdminRole;
  permissions?: string[];           // Custom permissions (null = use role defaults)
  effectivePermissions?: string[];  // Computed effective permissions from API
  isActive?: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt?: string;
  updatedAt?: string;
  // 2FA fields
  twoFactorEnabled?: boolean;
  twoFactorRequired?: boolean;
  twoFactorVerifiedAt?: string;
  twoFactorPending?: boolean; // Has unverified secret (stuck in setup)
}

// 2FA Types
export interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt?: string;
  requiredByAdmin: boolean;
  requiredBySystem: boolean;
  recoveryCodesLeft: number;
  configured: boolean;
}

export interface Setup2FAResponse {
  secret: string;
  qrCode: string;
  issuer: string;
  account: string;
}

export interface Verify2FAResponse {
  success: boolean;
  recoveryCodes: string[];
  message: string;
  token?: string;
  expiresAt?: number;
}

export interface TrustedDevice {
  id: number;
  deviceName: string;
  userAgent: string;
  ip: string;
  lastUsedAt?: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface LoginResponse {
  success: boolean;
  requiresTwoFA?: boolean;
  twoFAToken?: string;
  token?: string;
  expiresAt?: number;
  user?: AdminUser;
  needs2FASetup?: boolean;
  deviceToken?: string;
}

export interface PermissionTemplates {
  allPermissions: string[];
  roleTemplates: Record<string, string[]>;
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

// Analytics types
export interface AnalyticsRequest {
  startDate?: string;
  endDate?: string;
  preset?: '30d' | '90d' | 'all';
  force?: boolean; // Bypass cache and force recomputation
}

export interface AnalyticsSummary {
  totalResponses: number;
  dateRange: { start: string; end: string };
  questionCount: number;
}

export interface Distribution {
  bin: string;
  count: number;
}

export interface DimensionStat {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  median: number;
  distribution: Distribution[];
}

export interface ReliabilityStats {
  cronbachAlpha: number;
  itemTotalCorrelations: Record<string, number>;
  splitHalfReliability: number;
  spearmanBrown: number;
  sampleSize: number;
  minSampleSize?: number;
  hasSufficientSample?: boolean;
  byDimension?: Record<
    string,
    {
      cronbachAlpha: number;
      splitHalfReliability: number;
      spearmanBrown: number;
      sampleSize: number;
      hasSufficientSample?: boolean;
      itemTotalCorrelations?: Record<string, number>;
      questionCount?: number;
      validQuestionCount?: number;
    }
  >;
}

export interface TrendPoint {
  date: string;
  count: number;
  change: number;
}

export interface TrendData {
  daily: TrendPoint[];
  weekly: TrendPoint[];
  monthly: TrendPoint[];
}

export interface SegmentItem {
  name: string;
  count: number;
  percent: number;
}

export interface SegmentData {
  byRegion: SegmentItem[];
  byLanguage: SegmentItem[];
  byDevice: SegmentItem[];
  byChannel: SegmentItem[];
  byGlowtype: SegmentItem[];
}

// Shared constants from backend for consistency
export interface AnalyticsConstants {
  minReliabilitySample: number;
  minCorrelationSample: number;
  minValiditySample: number;
}

// Validity analysis types
export interface ConvergentStats {
  ave: number;           // Average Variance Extracted (should be > 0.5)
  cr: number;            // Composite Reliability (should be > 0.7)
  itemCount: number;
  meetsAVEThreshold: boolean;
  meetsCRThreshold: boolean;
}

export interface DiscriminantStats {
  fornellLarcker: Record<string, Record<string, number>>;  // sqrt(AVE) vs correlations
  htmt: Record<string, number>;                             // Heterotrait-Monotrait ratios
  passesFornellLarcker: boolean;
  passesHTMT: boolean;
}

export interface ValidityAssessment {
  convergentValid: boolean;
  discriminantValid: boolean;
  overallValid: boolean;
  interpretation: string;
  interpretationZh: string;
}

export interface ValidityStats {
  hasSufficientSample: boolean;
  sampleSize: number;
  minSampleSize: number;
  convergentValidity: Record<string, ConvergentStats>;
  discriminantValidity: DiscriminantStats;
  overallAssessment: ValidityAssessment;
}

// Group comparison types
export interface GroupStats {
  name: string;
  count: number;
  mean: number;
  stdDev: number;
}

export interface TTestStats {
  statistic: number;
  df: number;
  pValue: number;
}

export interface ANOVAStats {
  fStatistic: number;
  dfBetween: number;
  dfWithin: number;
  pValue: number;
}

export interface EffectStats {
  value: number;
  type: 'cohensD' | 'etaSquared';
  interpretation: string;
}

export interface DimensionComparison {
  groups: GroupStats[];
  tTest?: TTestStats;
  anova?: ANOVAStats;
  effectSize: EffectStats;
  significant: boolean;
}

export interface ExcludedDimensionInfo {
  dimension: string;
  reason: string;
  groupCounts: Record<string, number>;
}

export interface MissingDimRecord {
  id: number;
  language: string;
  missingDims: string[];
  presentDims: string[];
}

export interface GroupComparisonDebug {
  totalResults: number;
  parseErrors: number;
  languageCounts: Record<string, number>;
  dimensionsByLang: Record<string, Record<string, number>>;
  recordsWithMissingDim?: MissingDimRecord[];
}

export interface GroupComparisonData {
  byDevice: Record<string, DimensionComparison>;
  byLanguage: Record<string, DimensionComparison>;
  minSample: number;
  excludedDimensions?: ExcludedDimensionInfo[];
  debug?: GroupComparisonDebug;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  dimensionStats: Record<string, DimensionStat>;
  reliability: ReliabilityStats;
  validity: ValidityStats;
  groupComparison: GroupComparisonData;
  trends: TrendData;
  segments: SegmentData;
  correlationMatrix: Record<string, number>;
  constants: AnalyticsConstants;
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

// AI Settings (provider, model, API key)
export interface AISettings {
  id: number;
  provider: string;
  baseUrl: string;
  model: string;
  isActive: boolean;
  hasApiKey: boolean;
  apiKey?: string; // Masked key for display
  rateLimitEnabled: boolean;
  rateLimitRequestsPerMin: number;
  rateLimitBurst: number;
  updatedAt: string;
}

export interface AISettingsUpdate {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isActive?: boolean;
  rateLimitEnabled?: boolean;
  rateLimitRequestsPerMin?: number;
  rateLimitBurst?: number;
}

// Crisis Configuration Types
export interface CrisisConfigOverview {
  keywords: number;
  excludePatterns: number;
  resources: number;
  forbiddenPhrases: number;
  glowtypeGuidance: number;
  configVersion: number;
}

export interface CrisisSettings {
  id: number;
  tenantId?: number;
  sessionTTLMinutes: number;
  maxHistoryMessages: number;
  maxResourceShowsPerSession: number;
  enableKeywordDetection: boolean;
  enablePatternDetection: boolean;
  enableMLDetection: boolean;
  enableGlowtypeGuidance: boolean;
  level3AlertEnabled: boolean;
  level3AlertEmail: string;
  level3AlertWebhook: string;
  dailyDigestEnabled: boolean;
  dailyDigestEmail: string;
  configVersion: number;
  updatedAt: string;
}

export interface CrisisKeyword {
  id: number;
  tenantId?: number;
  level: number;
  language: string;
  keyword: string;
  category: string;
  isSlang: boolean;
  slangFor: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrisisExcludePattern {
  id: number;
  tenantId?: number;
  pattern: string;
  patternType: string;
  description: string;
  language: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrisisResource {
  id: number;
  tenantId?: number;
  country: string;
  name: string;
  nameZh: string;
  phone: string;
  url: string;
  hours: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrisisForbiddenPhrase {
  id: number;
  tenantId?: number;
  language: string;
  phrase: string;
  alternative: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrisisGlowtypeGuidance {
  id: number;
  tenantId?: number;
  glowtypeCode: string;
  language: string;
  fieldType: string;
  content: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrisisScript {
  id: number;
  tenantId?: number;
  title: string;
  titleZh?: string;
  content: string;
  contentZh?: string;
  mode: 'template' | 'reference';
  category?: string; // greeting, empathy, transition, resource, closing
  triggerKeywords?: string; // JSON array
  crisisLevels?: string; // JSON array [1,2,3]
  language: string;
  displayOrder: number;
  isActive: boolean;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
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
const DEVICE_TOKEN_KEY = 'admin_device_token';

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

// localStorage for device token (persists across sessions)
const deviceStorage = {
  get: () => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(DEVICE_TOKEN_KEY);
  },
  set: (value: string) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DEVICE_TOKEN_KEY, value);
  },
  remove: () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  },
};

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const isReadOnlyMethod = (method?: string) => READ_ONLY_METHODS.has((method ?? 'GET').toUpperCase());

const getCachedAdminUser = (): AdminUser | null => {
  const raw = storage.get(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

  // 2FA state
  const [requiresTwoFA, setRequiresTwoFA] = useState(false);
  const [twoFAToken, setTwoFAToken] = useState<string | null>(null);
  const [needs2FASetup, setNeeds2FASetup] = useState(false);

  const persistSession = (user: AdminUser, newToken: string, newDeviceToken?: string) => {
    storage.set(ADMIN_TOKEN_KEY, newToken);
    storage.set(ADMIN_USER_KEY, JSON.stringify(user));
    setToken(newToken);
    setCurrentUser(user);
    if (newDeviceToken) {
      deviceStorage.set(newDeviceToken);
    }
    // Check if user needs to setup 2FA
    setNeeds2FASetup(!user.twoFactorEnabled && (user.twoFactorRequired || false));
  };

  const logout = useCallback(() => {
    storage.remove(ADMIN_TOKEN_KEY);
    storage.remove(ADMIN_USER_KEY);
    setToken(null);
    setCurrentUser(null);
    setRequiresTwoFA(false);
    setTwoFAToken(null);
    setNeeds2FASetup(false);
  }, []);

  const getAuthHeader = useCallback((): Record<string, string> => {
    const activeToken = storage.get(ADMIN_TOKEN_KEY);
    const headers: Record<string, string> = {};
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }
    const deviceToken = deviceStorage.get();
    if (deviceToken) {
      headers['X-Device-Token'] = deviceToken;
    }
    return headers;
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
      const data = (await res.json()) as AdminUser & { needs2FASetup?: boolean };
      persistSession(data, token);
      if (data.needs2FASetup) {
        setNeeds2FASetup(true);
      }
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

  const login = async (username: string, password: string): Promise<LoginResponse> => {
    setLoading(true);
    setError(null);
    setLockUntil(null);
    setRequiresTwoFA(false);
    setTwoFAToken(null);
    try {
      const deviceToken = deviceStorage.get();
      const res = await fetch(`${getApiBaseUrl()}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deviceToken ? { 'X-Device-Token': deviceToken } : {}),
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json() as LoginResponse;

      if (res.ok && data.success) {
        // Check if 2FA is required
        if (data.requiresTwoFA && data.twoFAToken) {
          setRequiresTwoFA(true);
          setTwoFAToken(data.twoFAToken);
          return { success: true, requiresTwoFA: true, twoFAToken: data.twoFAToken };
        }

        // Normal login success
        if (data.token && data.user) {
          persistSession(data.user, data.token, data.deviceToken);
          return { success: true, user: data.user, needs2FASetup: data.needs2FASetup };
        }
      }

      if (res.status === 429 && (data as any).unlockAt) {
        setLockUntil((data as any).unlockAt);
      }
      setError((data as any).error || 'Login failed');
      return { success: false };
    } catch {
      setError('Connection error');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const authenticate2FA = async (
    code: string,
    trustDevice: boolean = false,
    deviceName: string = ''
  ): Promise<LoginResponse> => {
    if (!twoFAToken) {
      setError('No 2FA token available');
      return { success: false };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/2fa/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twoFAToken,
          code,
          trustDevice,
          deviceName,
        }),
      });
      const data = await res.json() as LoginResponse & { recoveryCodesLeft?: number; usedRecoveryCode?: boolean };

      if (res.ok && data.success && data.token && data.user) {
        setRequiresTwoFA(false);
        setTwoFAToken(null);
        persistSession(data.user, data.token, data.deviceToken);
        return { success: true, user: data.user };
      }

      setError((data as any).error || '2FA verification failed');
      return { success: false };
    } catch {
      setError('Connection error');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const cancel2FA = useCallback(() => {
    setRequiresTwoFA(false);
    setTwoFAToken(null);
    setError(null);
  }, []);

  // Update token without changing user (for 2FA setup completion)
  const updateToken = useCallback((newToken: string) => {
    storage.set(ADMIN_TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

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
    // 2FA
    requiresTwoFA,
    twoFAToken,
    authenticate2FA,
    cancel2FA,
    needs2FASetup,
    updateToken,
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
    const method = (options.method ?? 'GET').toString().toUpperCase();
    if (isReadOnlyRole(getCachedAdminUser()?.role) && !isReadOnlyMethod(method)) {
      setError('Read-only role cannot modify data.');
      return null;
    }
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
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if ((data as any).needs2FASetup) {
          window.location.assign('/admin/settings');
          return null;
        }
        throw new Error((data as any).error || 'Forbidden');
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
  const getAnalytics = (params?: AnalyticsRequest) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('start_date', params.startDate);
    if (params?.endDate) query.set('end_date', params.endDate);
    if (params?.preset) query.set('preset', params.preset);
    if (params?.force) query.set('force', 'true');
    const qs = query.toString();
    return apiCall<AnalyticsResponse>(`/admin/stats/analytics${qs ? `?${qs}` : ''}`);
  };

  // Crisis Analytics
  const getCrisisAnalytics = (preset: string = '30d') => {
    return apiCall<any>(`/admin/stats/crisis?preset=${preset}`);
  };

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
  const getPermissionTemplates = useCallback(
    () => apiCall<PermissionTemplates>('/admin/permissions/templates'),
    [apiCall],
  );
  const createAdmin = useCallback(
    (data: { username: string; password: string; role?: AdminRole; permissions?: string[] }) =>
      apiCall<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    [apiCall],
  );
  const updateAdmin = useCallback(
    (id: number, data: { role?: AdminRole; isActive?: boolean; permissions?: string[] }) =>
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
    getAnalytics,
    getCrisisAnalytics,
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
    getPermissionTemplates,
    createAdmin,
    updateAdmin,
    listAuditLogs,
    // AI Settings (superadmin only)
    getAISettings: () => apiCall<AISettings>('/admin/ai/settings'),
    updateAISettings: (data: AISettingsUpdate) =>
      apiCall<AISettings>('/admin/ai/settings', { method: 'PUT', body: JSON.stringify(data) }),

    // 2FA Management
    get2FAStatus: () => apiCall<TwoFactorStatus>('/admin/2fa/status'),
    setup2FA: (currentCode?: string) =>
      apiCall<Setup2FAResponse>('/admin/2fa/setup', {
        method: 'POST',
        body: currentCode ? JSON.stringify({ currentCode }) : undefined,
      }),
    verify2FA: (code: string) =>
      apiCall<Verify2FAResponse>('/admin/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) }),
    disable2FA: (code: string) =>
      apiCall<{ success: boolean; message: string; token?: string; expiresAt?: number }>('/admin/2fa', { method: 'DELETE', body: JSON.stringify({ code }) }),
    regenerateRecoveryCodes: (code: string) =>
      apiCall<{ success: boolean; recoveryCodes: string[]; message: string }>('/admin/2fa/recovery/regenerate', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),

    // Trusted Devices
    listTrustedDevices: () => apiCall<TrustedDevice[]>('/admin/2fa/devices'),
    revokeTrustedDevice: (id: number) =>
      apiCall<{ success: boolean }>(`/admin/2fa/devices/${id}`, { method: 'DELETE' }),
    revokeAllTrustedDevices: () =>
      apiCall<{ success: boolean }>('/admin/2fa/devices', { method: 'DELETE' }),

    // Superadmin 2FA Management
    manageUser2FA: (userId: number, data: { forceEnabled?: boolean; reset?: boolean }) =>
      apiCall<AdminUser>(`/admin/users/${userId}/2fa`, { method: 'PUT', body: JSON.stringify(data) }),

    // Reset Admin Password (superadmin only)
    resetAdminPassword: (userId: number, password: string) =>
      apiCall<{ message: string }>(`/admin/users/${userId}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),

    // Change Password
    changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
      apiCall<{ success: boolean; message: string }>('/admin/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      }),

    // Crisis Configuration (superadmin only)
    getCrisisOverview: () => apiCall<CrisisConfigOverview>('/admin/crisis/overview'),
    getCrisisSettings: () => apiCall<CrisisSettings>('/admin/crisis/settings'),
    updateCrisisSettings: (data: Partial<CrisisSettings>) =>
      apiCall<CrisisSettings>('/admin/crisis/settings', { method: 'PUT', body: JSON.stringify(data) }),
    getCrisisConfigVersion: () => apiCall<{ version: number }>('/admin/crisis/version'),

    // Crisis Keywords
    listCrisisKeywords: (params?: { level?: number; language?: string; active?: boolean }) => {
      const query = new URLSearchParams();
      if (params?.level) query.set('level', params.level.toString());
      if (params?.language) query.set('language', params.language);
      if (params?.active !== undefined) query.set('active', params.active.toString());
      const qs = query.toString();
      return apiCall<CrisisKeyword[]>(`/admin/crisis/keywords${qs ? `?${qs}` : ''}`);
    },
    createCrisisKeyword: (data: Partial<CrisisKeyword>) =>
      apiCall<CrisisKeyword>('/admin/crisis/keywords', { method: 'POST', body: JSON.stringify(data) }),
    updateCrisisKeyword: (id: number, data: Partial<CrisisKeyword>) =>
      apiCall<CrisisKeyword>(`/admin/crisis/keywords/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCrisisKeyword: (id: number) =>
      apiCall<{ message: string }>(`/admin/crisis/keywords/${id}`, { method: 'DELETE' }),

    // Crisis Exclude Patterns
    listCrisisPatterns: () => apiCall<CrisisExcludePattern[]>('/admin/crisis/patterns'),
    createCrisisPattern: (data: Partial<CrisisExcludePattern>) =>
      apiCall<CrisisExcludePattern>('/admin/crisis/patterns', { method: 'POST', body: JSON.stringify(data) }),
    updateCrisisPattern: (id: number, data: Partial<CrisisExcludePattern>) =>
      apiCall<CrisisExcludePattern>(`/admin/crisis/patterns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCrisisPattern: (id: number) =>
      apiCall<{ message: string }>(`/admin/crisis/patterns/${id}`, { method: 'DELETE' }),

    // Crisis Resources
    listCrisisResources: (country?: string) => {
      const query = country ? `?country=${country}` : '';
      return apiCall<CrisisResource[]>(`/admin/crisis/resources${query}`);
    },
    createCrisisResource: (data: Partial<CrisisResource>) =>
      apiCall<CrisisResource>('/admin/crisis/resources', { method: 'POST', body: JSON.stringify(data) }),
    updateCrisisResource: (id: number, data: Partial<CrisisResource>) =>
      apiCall<CrisisResource>(`/admin/crisis/resources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCrisisResource: (id: number) =>
      apiCall<{ message: string }>(`/admin/crisis/resources/${id}`, { method: 'DELETE' }),

    // Crisis Forbidden Phrases
    listCrisisPhrases: (language?: string) => {
      const query = language ? `?language=${language}` : '';
      return apiCall<CrisisForbiddenPhrase[]>(`/admin/crisis/phrases${query}`);
    },
    createCrisisPhrase: (data: Partial<CrisisForbiddenPhrase>) =>
      apiCall<CrisisForbiddenPhrase>('/admin/crisis/phrases', { method: 'POST', body: JSON.stringify(data) }),
    updateCrisisPhrase: (id: number, data: Partial<CrisisForbiddenPhrase>) =>
      apiCall<CrisisForbiddenPhrase>(`/admin/crisis/phrases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCrisisPhrase: (id: number) =>
      apiCall<{ message: string }>(`/admin/crisis/phrases/${id}`, { method: 'DELETE' }),

    // Crisis Glowtype Guidance
    listCrisisGuidance: (params?: { glowtypeCode?: string; language?: string }) => {
      const query = new URLSearchParams();
      if (params?.glowtypeCode) query.set('glowtypeCode', params.glowtypeCode);
      if (params?.language) query.set('language', params.language);
      const qs = query.toString();
      return apiCall<CrisisGlowtypeGuidance[]>(`/admin/crisis/guidance${qs ? `?${qs}` : ''}`);
    },
    createCrisisGuidance: (data: Partial<CrisisGlowtypeGuidance>) =>
      apiCall<CrisisGlowtypeGuidance>('/admin/crisis/guidance', { method: 'POST', body: JSON.stringify(data) }),
    updateCrisisGuidance: (id: number, data: Partial<CrisisGlowtypeGuidance>) =>
      apiCall<CrisisGlowtypeGuidance>(`/admin/crisis/guidance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCrisisGuidance: (id: number) =>
      apiCall<{ message: string }>(`/admin/crisis/guidance/${id}`, { method: 'DELETE' }),

    // Crisis Scripts (expert-reviewed conversation scripts)
    listCrisisScripts: (params?: { mode?: string; category?: string; language?: string; active?: boolean }) => {
      const query = new URLSearchParams();
      if (params?.mode) query.set('mode', params.mode);
      if (params?.category) query.set('category', params.category);
      if (params?.language) query.set('language', params.language);
      if (params?.active !== undefined) query.set('active', params.active.toString());
      const qs = query.toString();
      return apiCall<CrisisScript[]>(`/admin/crisis/scripts${qs ? `?${qs}` : ''}`);
    },
    createCrisisScript: (data: Partial<CrisisScript>) =>
      apiCall<CrisisScript>('/admin/crisis/scripts', { method: 'POST', body: JSON.stringify(data) }),
    updateCrisisScript: (id: number, data: Partial<CrisisScript>) =>
      apiCall<CrisisScript>(`/admin/crisis/scripts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCrisisScript: (id: number) =>
      apiCall<{ message: string }>(`/admin/crisis/scripts/${id}`, { method: 'DELETE' }),

    // Crisis Reset
    resetCrisisConfig: (options: { all?: boolean; keywords?: boolean; patterns?: boolean; resources?: boolean; phrases?: boolean; guidance?: boolean }) => {
      const query = new URLSearchParams();
      if (options.all) query.set('all', 'true');
      if (options.keywords) query.set('keywords', 'true');
      if (options.patterns) query.set('patterns', 'true');
      if (options.resources) query.set('resources', 'true');
      if (options.phrases) query.set('phrases', 'true');
      if (options.guidance) query.set('guidance', 'true');
      return apiCall<{ message: string; results: Record<string, number> }>(`/admin/crisis/reset?${query.toString()}`, { method: 'POST' });
    },
  };
};
