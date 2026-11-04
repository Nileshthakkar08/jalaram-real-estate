import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { PublicLayout } from '@/components/site/public-layout';
import { ListingBrowser } from '@/components/site/listing-browser';
import { LoadingState } from '@/components/shared/states';
import { serverApi, ServerApiError } from '@/lib/server-api';
import { listingApiQuery, searchParamsSource } from '@/lib/listing-query';
import { listingHeading, listingPath, parseListingSlug } from '@/lib/listing-path';
import { listingSummary, summaryText } from '@/lib/listing-summary';
import type { Locality } from '@/lib/types';

/**
 * Clean search URLs, e.g. /3-bhk-flats-for-rent-in-shilaj-ahmedabad or /villas-for-sale-in-ahmedabad.
 * Static routes (/buy, /about, ...) always take precedence over this dynamic segment.
 */
interface PageProps {
  params: { listing: string };
  searchParams: Record<string, string | string[] | undefined>;
}

async function resolve(slug: string) {
  const parsed = parseListingSlug(slug);
  if (!parsed) return null;

  let locality: Locality | null = null;
  if (parsed.locality) {
    try {
      locality = await serverApi.locality(parsed.locality);
    } catch (error) {
      if (error instanceof ServerApiError && error.status === 404) return null;
      throw error;
    }
  }
  return { ...parsed, localityName: locality?.name, localityDescription: locality?.description ?? null };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const page = await resolve(params.listing).catch(() => null);
  if (!page) return { title: 'Page Not Found', robots: { index: false } };

  const filters = { locality: page.locality, bhk: page.bhk, type: page.type };
  const heading = listingHeading(page.purpose, filters, page.localityName);
  const { total, minPrice, canonical } = await listingSummary(page.purpose, filters);
  const pageNo = Number(searchParamsSource(searchParams).get('page') ?? 1) || 1;
  const path = listingPath(page.purpose, filters);
  const canonicalPath = listingPath(page.purpose, canonical);
  const summary = total > 0 ? summaryText(page.purpose, total, minPrice) : null;

  return {
    title: summary ? `${heading} – ${summary}` : heading,
    description: summary
      ? `${summary}: ${heading.charAt(0).toLowerCase()}${heading.slice(1)}, listed with Jalaram Real Estate. Listings reviewed by our team; enquiries and site visits handled centrally.`
      : `${heading} — listed with Jalaram Real Estate.`,
    // Pages showing the same listings as a more specific page point Google to that page.
    alternates: { canonical: pageNo > 1 ? `${canonicalPath}?page=${pageNo}` : canonicalPath },
    // A combination with no live listings has nothing to show: keep it out of the index.
    robots: total === 0 ? { index: false, follow: true } : undefined,
    openGraph: { title: summary ? `${heading} – ${summary}` : heading, url: path, type: 'website' },
  };
}

export default async function ListingSearchPage({ params, searchParams }: PageProps) {
  const page = await resolve(params.listing);
  if (!page) notFound();

  const filters = { locality: page.locality, bhk: page.bhk, type: page.type };
  const heading = listingHeading(page.purpose, filters, page.localityName);
  const query = listingApiQuery(page.purpose, searchParamsSource(searchParams), filters);
  const [result, localities] = await Promise.all([
    serverApi.maybe(serverApi.properties(`?${query}`)),
    serverApi.maybe(serverApi.localities()),
  ]);
  const purposeHref = listingPath(page.purpose, {});

  return (
    <PublicLayout>
      <nav aria-label="Breadcrumb" className="border-b border-border bg-card">
        <div className="container-mw container-px flex flex-wrap items-center gap-1.5 py-3 text-sm text-muted-foreground">
          <Link href="/" className="flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" /> Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={purposeHref} className="hover:text-primary">{page.purpose === 'sale' ? 'Buy' : 'Rent'}</Link>
          {page.locality && page.localityName && (page.bhk || page.type) && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href={listingPath(page.purpose, { locality: page.locality })} className="hover:text-primary">{page.localityName}</Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate text-primary" aria-current="page">{heading}</span>
        </div>
      </nav>
      <Suspense fallback={<LoadingState label="Loading properties" />}>
        <ListingBrowser
          listingType={page.purpose}
          pathFilters={filters}
          initial={{ query, result }}
          localities={localities ?? undefined}
          title={heading}
          subtitle={
            (page.localityDescription && !page.bhk && !page.type ? `${page.localityDescription} ` : '') +
            (result?.meta.total
              ? `${result.meta.total} ${result.meta.total === 1 ? 'property' : 'properties'} found. Every enquiry is handled by the Jalaram team, who arrange visits with the owner.`
              : 'No matching properties right now. Try other filters, or contact us with your requirement.')
          }
        />
      </Suspense>
    </PublicLayout>
  );
}
