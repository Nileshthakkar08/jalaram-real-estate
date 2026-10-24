import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/server-api';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const staticPages = ['', '/buy', '/rent', '/sell-property', '/list-property', '/about', '/contact', '/privacy-policy', '/terms'];
  const data = await serverApi.maybe(serverApi.sitemap());

  return [
    ...staticPages.map((path) => ({ url: `${base}${path}`, changeFrequency: 'weekly' as const, priority: path === '' ? 1 : 0.7 })),
    ...(data?.localities ?? []).map((l) => ({ url: `${base}/areas/${l.slug}`, lastModified: l.updated_at, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...(data?.properties ?? []).map((p) => ({ url: `${base}/property/${p.slug}`, lastModified: p.updated_at, changeFrequency: 'daily' as const, priority: 0.8 })),
  ];
}
