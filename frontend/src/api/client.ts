const defaultBase =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${defaultBase}${path}`, {
    ...init,
    method: 'GET',
  });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function apiPost<T, B = unknown>(
  path: string,
  body: B,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${defaultBase}${path}`, {
    ...init,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

