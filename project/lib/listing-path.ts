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
