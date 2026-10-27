/**
 * Builds the public search API query for the listing pages. Shared by server pages (initial,
 * crawlable render) and the client ListingBrowser, so both produce the identical string and the
 * browser can reuse the server result instead of refetching.
 */
export const LISTING_PAGE_SIZE = 12;

type ParamSource = { get(key: string): string | null };

export function listingApiQuery(purpose: 'sale' | 'rent', params: ParamSource, fixedLocality?: string): string {
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const query = new URLSearchParams({
    purpose,
    sort: params.get('sort') ?? 'newest',
    page: String(page),
    per_page: String(LISTING_PAGE_SIZE),
  });
  const locality = fixedLocality ?? params.get('locality');
  const filters: [string, string | null | undefined][] = [
    ['locality', locality],
    ['type', params.get('type')],
    ['bhk', params.get('bhk')],
    ['min_price', params.get('min_price')],
    ['max_price', params.get('max_price')],
    ['furnishing', params.get('furnishing')],
    ['q', params.get('q')],
  ];
  filters.forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return query.toString();
}

/** Adapts Next.js page `searchParams` to the same `get()` interface as URLSearchParams. */
export function searchParamsSource(searchParams: Record<string, string | string[] | undefined>): ParamSource {
  return {
    get: (key) => {
      const value = searchParams[key];
      return Array.isArray(value) ? value[0] ?? null : value ?? null;
    },
  };
}
