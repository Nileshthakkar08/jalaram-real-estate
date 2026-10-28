import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/server-api';
import { listingPath, type PathFilters } from '@/lib/listing-path';
import type { PublicProperty } from '@/lib/types';

export const revalidate = 3600;

/** Every public listing, page by page (the API caps a page at 50). */
async function allPublicProperties(): Promise<PublicProperty[]> {
  const all: PublicProperty[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = await serverApi.maybe(serverApi.properties(`?per_page=50&page=${page}`));
    if (!result) break;
    all.push(...result.data);
    if (page >= result.meta.last_page) break;
  }
  return all;
}

/** Clean search URLs that contain this listing (area / BHK / type combinations). */
function searchPathsFor(property: PublicProperty): string[] {
  const bedrooms = property.bedrooms ?? 0;
  const values: PathFilters = {
    locality: property.locality?.slug,
    bhk: property.property_type !== 'plot' && bedrooms > 0 ? String(Math.min(bedrooms, 5)) : undefined,
    type: property.property_type,
  };
  const keys = (Object.keys(values) as (keyof PathFilters)[]).filter((k) => values[k]);
  const paths: string[] = [];
  // Every non-empty combination of the listing's own area, BHK and type.
  for (let mask = 1; mask < 1 << keys.length; mask++) {
    const filters: PathFilters = {};
    keys.forEach((key, i) => {
      if (mask & (1 << i)) filters[key] = values[key];
    });
    paths.push(listingPath(property.listing_purpose, filters));
  }
  return paths;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  // Only canonical, indexable pages. /list-property is a sign-in gateway (noindex), and the
  // homepage uses the trailing slash to match its canonical URL.
  const staticPages = ['/', '/buy', '/rent', '/sell-property', '/about', '/contact', '/privacy-policy', '/terms'];
  // Area pages (/areas/x) canonicalise to these clean search URLs, so only the latter are listed.
  const properties = await allPublicProperties();

  // Search pages that have at least one live listing (empty combinations are noindex).
  const searchPaths = new Set(properties.flatMap(searchPathsFor));

  return [
    ...staticPages.map((path) => ({ url: `${base}${path}`, changeFrequency: 'weekly' as const, priority: path === '/' ? 1 : 0.7 })),
    ...Array.from(searchPaths).map((path) => ({ url: `${base}${path}`, changeFrequency: 'daily' as const, priority: 0.7 })),
    ...properties.map((p) => ({ url: `${base}/property/${p.slug}`, lastModified: p.updated_at ?? undefined, changeFrequency: 'daily' as const, priority: 0.8 })),
  ];
}
