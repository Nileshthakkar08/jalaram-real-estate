import 'server-only';
import { formatPriceShort } from '@/lib/format';
import { canonicalFilters, type PathFilters, type Purpose } from '@/lib/listing-path';
import { listingApiQuery } from '@/lib/listing-query';
import { serverApi } from '@/lib/server-api';

/** Above this many results a page is varied enough to be its own canonical; below, check for duplicates. */
const SUMMARY_LIMIT = 50;

/** Live listing count, lowest price and canonical filters for a search page. */
export async function listingSummary(purpose: Purpose, filters: PathFilters) {
  const query = new URLSearchParams(listingApiQuery(purpose, { get: () => null }, filters));
  query.set('sort', 'price_asc');
  query.set('per_page', String(SUMMARY_LIMIT));
  const result = await serverApi.maybe(serverApi.properties(`?${query}`));
  const total = result?.meta.total ?? 0;
  const listings = result?.data ?? [];
  return {
    total,
    minPrice: listings.length ? Number(listings[0].price) : null,
    canonical: total > 0 && total <= SUMMARY_LIMIT ? canonicalFilters(filters, listings) : filters,
  };
}

/** e.g. "3 Listings from ₹28 L" or "1 Listing at ₹15,000/month": real numbers that help searchers pick a result. */
export function summaryText(purpose: Purpose, total: number, minPrice: number | null): string {
  const price = minPrice ? `${formatPriceShort(minPrice)}${purpose === 'rent' ? '/month' : ''}` : null;
  const count = `${total} Listing${total === 1 ? '' : 's'}`;
  if (!price) return count;
  return total === 1 ? `${count} at ${price}` : `${count} from ${price}`;
}
