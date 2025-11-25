const sanitizeBase = (base: string) => base.replace(/\/$/, '');

const getOriginBase = () => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }
  return `${window.location.origin.replace(/\/$/, '')}/api/v1`;
};

/**
 * Resolve the API base URL.
 * - Prefer runtime overrides via window.ENV (for Docker/runtime config)
 * - In dev, honor VITE_API_BASE_URL for local backend access
 * - Otherwise default to the current origin to avoid hard-coded hosts
 */
export const getApiBaseUrl = () => {
  const windowEnv = (typeof window !== 'undefined' && (window as any).ENV) || {};

  if (windowEnv.API_BASE_URL) {
    return sanitizeBase(windowEnv.API_BASE_URL);
  }

  if (import.meta.env.DEV && import.meta.env.VITE_API_BASE_URL) {
    return sanitizeBase(import.meta.env.VITE_API_BASE_URL);
  }

  const originBase = getOriginBase();
  if (originBase) {
    return sanitizeBase(originBase);
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    return sanitizeBase(import.meta.env.VITE_API_BASE_URL);
  }

  return '/api/v1';
};
