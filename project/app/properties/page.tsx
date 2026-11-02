import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PublicLayout } from '@/components/site/public-layout';
import { ListingBrowser } from '@/components/site/listing-browser';
import { LoadingState } from '@/components/shared/states';
import { serverApi } from '@/lib/server-api';
import { listingApiQuery, searchParamsSource } from '@/lib/listing-query';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const source = searchParamsSource(searchParams);
  const pageNo = Number(source.get('page') ?? 1) || 1;
  // Filtered views of this page duplicate the clean search URLs (/2-bhk-flats-for-sale-in-...),
  // so only the unfiltered list is indexed.
  const filtered = ['locality', 'bhk', 'type', 'min_price', 'max_price', 'furnishing', 'q', 'sort'].some((k) => source.get(k));
  return {
    title: 'All Properties for Sale and Rent in Ahmedabad',
    description: 'Every property currently listed with Jalaram Real Estate in Ahmedabad, for sale and for rent. Filter by locality, type, budget and BHK.',
    alternates: { canonical: pageNo > 1 && !filtered ? `/properties?page=${pageNo}` : '/properties' },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function AllPropertiesPage({ searchParams }: PageProps) {
  // Render the first page of results on the server so listings are in the crawlable HTML.
  const query = listingApiQuery('all', searchParamsSource(searchParams));
  const [result, localities] = await Promise.all([
    serverApi.maybe(serverApi.properties(`?${query}`)),
    serverApi.maybe(serverApi.localities()),
  ]);

  return (
    <PublicLayout>
      <Suspense fallback={<LoadingState label="Loading properties" />}>
        <ListingBrowser
          listingType="all"
          initial={{ query, result }}
          localities={localities ?? undefined}
          title="All Properties in Ahmedabad"
          subtitle="Every property listed with Jalaram Real Estate, for sale and for rent, newest first. Each listing is reviewed by our team before publishing."
        />
      </Suspense>
    </PublicLayout>
  );
}
