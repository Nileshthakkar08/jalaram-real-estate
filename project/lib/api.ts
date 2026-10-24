/**
 * Browser API client. Talks to the same origin (`/api/v1`), which is proxied to Laravel, so
 * Sanctum session cookies and CSRF protection work without any tokens in browser storage.
 */

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }

  /** First message for a field, for inline form errors. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

const BASE = '/api/v1';
let csrfReady: Promise<void> | null = null;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

async function ensureCsrf(force = false): Promise<void> {
  if (!force && readCookie('XSRF-TOKEN')) return;
  if (!csrfReady || force) {
    csrfReady = fetch('/sanctum/csrf-cookie', { credentials: 'include' }).then(() => undefined);
  }
  return csrfReady;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown, retry = true): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (method !== 'GET') await ensureCsrf();

  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
  const xsrf = readCookie('XSRF-TOKEN');
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }

  // Expired CSRF token: refresh once and retry.
  if (response.status === 419 && retry) {
    await ensureCsrf(true);
    return request<T>(method, path, body, false);
  }

  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const fallback =
      response.status === 401 ? 'Please sign in to continue.'
      : response.status === 403 ? 'You do not have permission to do that.'
      : response.status === 404 ? 'Not found.'
      : response.status === 429 ? 'Too many requests. Please wait a moment and try again.'
      : response.status >= 500 ? 'Something went wrong on our side. Please try again.'
      : 'The request could not be completed.';
    throw new ApiError(response.status, json?.message || fallback, json?.errors ?? {});
  }

  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

/** Build a query string, dropping empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const first = Object.values(error.errors)[0]?.[0];
    return first && error.status === 422 ? first : error.message;
  }
  return 'Something went wrong. Please try again.';
}
