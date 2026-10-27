import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/server-api';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  // Only canonical, indexable pages. /list-property is a sign-in gateway (noindex), and the
  // homepage uses the trailing slash to match its canonical URL.
  const staticPages = ['/', '/buy', '/rent', '/sell-property', '/about', '/contact', '/privacy-policy', '/terms'];
  const [data, localities] = await Promise.all([
    serverApi.maybe(serverApi.sitemap()),
    serverApi.maybe(serverApi.localities()),
  ]);

  return [
    ...staticPages.map((path) => ({ url: `${base}${path}`, changeFrequency: 'weekly' as const, priority: path === '/' ? 1 : 0.7 })),
    // Area pages without live listings are noindex, so they are left out until listings exist.
    ...(localities ?? [])
      .filter((l) => (l.listing_count ?? 0) > 0)
      .map((l) => ({ url: `${base}/areas/${l.slug}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...(data?.properties ?? []).map((p) => ({ url: `${base}/property/${p.slug}`, lastModified: p.updated_at, changeFrequency: 'daily' as const, priority: 0.8 })),
  ];
}
