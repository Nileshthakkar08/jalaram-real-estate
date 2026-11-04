/**
 * SEO-friendly search URLs, e.g. /3-bhk-flats-for-rent-in-shilaj-ahmedabad.
 * Built and parsed in one place so links, filters, server pages and the sitemap always agree.
 */

export type Purpose = 'sale' | 'rent';

export interface PathFilters {
  locality?: string; // locality slug
  bhk?: string; // '1'..'5' ('5' means 5+)
  type?: string; // property_type value
}

/** URL noun for each property type ("properties" when no type is chosen). */
const TYPE_NOUN: Record<string, string> = {
  apartment: 'flats',
  independent_house: 'houses',
  villa: 'villas',
  plot: 'plots',
};
const NOUN_TYPE: Record<string, string> = Object.fromEntries(Object.entries(TYPE_NOUN).map(([t, n]) => [n, t]));

const SLUG_PATTERN = /^(?:([1-5])-bhk-)?(flats|houses|villas|plots|properties)-for-(rent|sale)-in-(?:([a-z0-9]+(?:-[a-z0-9]+)*)-)?ahmedabad$/;

/** Plots have no bedrooms, so a BHK filter never applies to them. */
function normalise(filters: PathFilters): PathFilters {
  const type = filters.type && TYPE_NOUN[filters.type] ? filters.type : undefined;
  const bhk = type !== 'plot' && filters.bhk && /^[1-5]$/.test(filters.bhk) ? filters.bhk : undefined;
  const locality = filters.locality && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(filters.locality) ? filters.locality : undefined;
  return { locality, bhk, type };
}

/** `/buy` or `/rent` when nothing is chosen; otherwise the clean search URL. */
export function listingPath(purpose: Purpose, filters: PathFilters): string {
  const { locality, bhk, type } = normalise(filters);
  if (!locality && !bhk && !type) return purpose === 'sale' ? '/buy' : '/rent';

  const noun = type ? TYPE_NOUN[type] : 'properties';
  return `/${bhk ? `${bhk}-bhk-` : ''}${noun}-for-${purpose}-in-${locality ? `${locality}-` : ''}ahmedabad`;
}

/** Parses a clean search slug; null if it isn't one (so the route can 404). */
export function parseListingSlug(slug: string): ({ purpose: Purpose } & PathFilters) | null {
  const match = SLUG_PATTERN.exec(slug);
  if (!match) return null;
  const [, bhk, noun, purpose, locality] = match;
  const type = NOUN_TYPE[noun];
  if (type === 'plot' && bhk) return null;

  const parsed = { purpose: purpose as Purpose, bhk, type, locality };
  // Reject anything that would not round-trip (e.g. no filters at all → that's /buy or /rent).
  return listingPath(parsed.purpose, parsed) === `/${slug}` ? parsed : null;
}

/** Human heading, e.g. "3 BHK Flats for Rent in Shilaj, Ahmedabad". */
export function listingHeading(purpose: Purpose, filters: PathFilters, localityName?: string): string {
  const { bhk, type } = normalise(filters);
  const noun = type ? TYPE_NOUN[type] : 'properties';
  const bhkLabel = bhk ? `${bhk === '5' ? '5+' : bhk} BHK ` : '';
  const place = localityName ? `${localityName}, Ahmedabad` : 'Ahmedabad';
  return `${bhkLabel}${noun.charAt(0).toUpperCase()}${noun.slice(1)} for ${purpose === 'sale' ? 'Sale' : 'Rent'} in ${place}`;
}

/** The fields of a listing that decide which search pages it appears on. */
export interface ListingFacets {
  listing_purpose?: string;
  property_type: string;
  bedrooms: number | null;
  locality?: { slug: string } | null;
}

/** A listing's own area / BHK / type, as search-page filters. */
export function facetsOf(listing: ListingFacets): PathFilters {
  const bedrooms = listing.bedrooms ?? 0;
  return {
    locality: listing.locality?.slug,
    bhk: listing.property_type !== 'plot' && bedrooms > 0 ? String(Math.min(bedrooms, 5)) : undefined,
    type: listing.property_type,
  };
}

/** Whether a listing appears on the search page for these filters (same rules as the API). */
export function matchesFilters(listing: ListingFacets, purpose: Purpose, filters: PathFilters): boolean {
  if (listing.listing_purpose !== undefined && listing.listing_purpose !== purpose) return false;
  const own = facetsOf(listing);
  const { locality, bhk, type } = normalise(filters);
  return (!locality || own.locality === locality) && (!bhk || own.bhk === bhk) && (!type || own.type === type);
}

/**
 * The page Google should index for a search whose results are `listings` (all of them).
 *
 * With few listings, several URLs show exactly the same results: if every 2 BHK in Vastral is a
 * flat, /2-bhk-properties-for-sale-in-vastral-ahmedabad and /2-bhk-flats-for-sale-in-vastral-ahmedabad
 * are duplicates that split Google's trust. Any area, BHK or type shared by every result is added,
 * so all duplicates point to the most specific one (which is also how people search: "2 bhk flat in
 * vastral"). As listings become varied, each page becomes its own canonical again.
 */
export function canonicalFilters(filters: PathFilters, listings: ListingFacets[]): PathFilters {
  const result = normalise(filters);
  if (listings.length === 0) return result;
  const facets = listings.map(facetsOf);
  (['type', 'bhk', 'locality'] as const).forEach((key) => {
    if (result[key]) return;
    const first = facets[0][key];
    if (first && facets.every((f) => f[key] === first)) result[key] = first;
  });
  return normalise(result);
}
