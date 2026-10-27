import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PublicLayout } from '@/components/site/public-layout';
import { ListingBrowser } from '@/components/site/listing-browser';
import { LoadingState } from '@/components/shared/states';
import { serverApi } from '@/lib/server-api';
import { listingApiQuery, searchParamsSource } from '@/lib/listing-query';

export const metadata: Metadata = {
  title: 'Rent Property in Ahmedabad',
  description: 'Browse residential properties for rent in Ahmedabad. Filter by locality, property type, budget, furnishing, and BHK.',
  alternates: { canonical: '/rent' },
};

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function RentPage({ searchParams }: PageProps) {
  // Render the first page of results on the server so listings are in the crawlable HTML.
  const query = listingApiQuery('rent', searchParamsSource(searchParams));
  const [result, localities] = await Promise.all([
    serverApi.maybe(serverApi.properties(`?${query}`)),
    serverApi.maybe(serverApi.localities()),
  ]);

  return (
    <PublicLayout>
      <Suspense fallback={<LoadingState label="Loading properties" />}>
        <ListingBrowser
          listingType="rent"
          initial={{ query, result }}
          localities={localities ?? undefined}
          title="Properties for Rent in Ahmedabad"
          subtitle="Find quality rental homes in your preferred locality and budget across Ahmedabad."
        />
      </Suspense>
    </PublicLayout>
  );
}
