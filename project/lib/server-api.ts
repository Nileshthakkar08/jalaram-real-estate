import 'server-only';
import type { Locality, Paginated, PublicProperty, PublicSettings } from '@/lib/types';

/**
 * Server-side fetches for public, indexable pages. Uses the internal API URL and short
 * revalidation so listings stay fresh without hammering the API.
 */
const API = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:8000').replace(/\/$/, '') + '/api/v1';

// Lets these renders skip the API's per-IP rate limit (all visitors' pages are rendered from a few
// Netlify addresses). Must match INTERNAL_API_KEY on the API server; never sent to the browser.
const HEADERS: Record<string, string> = { Accept: 'application/json' };
if (process.env.API_INTERNAL_KEY) HEADERS['X-Internal-Key'] = process.env.API_INTERNAL_KEY;

export class ServerApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function get<T>(path: string, revalidate = 60): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: HEADERS, next: { revalidate } });
  } catch {
    throw new ServerApiError(503, 'The property service is unavailable.');
  }
  if (!res.ok) throw new ServerApiError(res.status, `API ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

/** Returns null instead of throwing, for optional page sections. */
async function maybe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export const serverApi = {
  settings: () => maybe(get<{ data: PublicSettings }>('/settings/public', 300)).then((r) => r?.data ?? {}),
  localities: () => get<{ data: Locality[] }>('/localities', 300).then((r) => r.data),
  locality: (slug: string) => get<{ data: Locality }>(`/localities/${encodeURIComponent(slug)}`, 300).then((r) => r.data),
  properties: (query: string) => get<Paginated<PublicProperty>>(`/properties${query}`),
  property: (slug: string) =>
    get<{ data: PublicProperty; similar: PublicProperty[] }>(`/properties/${encodeURIComponent(slug)}`),
  sitemap: () =>
    get<{ data: { properties: { slug: string; updated_at: string }[]; localities: { slug: string; updated_at: string }[] } }>('/sitemap', 3600)
      .then((r) => r.data),
  maybe,
};
