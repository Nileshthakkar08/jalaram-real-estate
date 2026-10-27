import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PublicLayout } from '@/components/site/public-layout';
import { ListingBrowser } from '@/components/site/listing-browser';
import { LoadingState } from '@/components/shared/states';
import { serverApi } from '@/lib/server-api';
import { listingApiQuery, searchParamsSource } from '@/lib/listing-query';

export const metadata: Metadata = {
  title: 'Buy Property in Ahmedabad',
  description: 'Browse reviewed residential properties for sale in Ahmedabad. Filter by locality, property type, budget, and BHK.',
  alternates: { canonical: '/buy' },
};

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function BuyPage({ searchParams }: PageProps) {
  // Render the first page of results on the server so listings are in the crawlable HTML.
  const query = listingApiQuery('sale', searchParamsSource(searchParams));
  const [result, localities] = await Promise.all([
    serverApi.maybe(serverApi.properties(`?${query}`)),
    serverApi.maybe(serverApi.localities()),
  ]);

  return (
    <PublicLayout>
      <Suspense fallback={<LoadingState label="Loading properties" />}>
        <ListingBrowser
          listingType="sale"
          initial={{ query, result }}
          localities={localities ?? undefined}
          title="Properties for Sale in Ahmedabad"
          subtitle="Browse residential properties for sale across Ahmedabad’s finest neighbourhoods, reviewed by our team before publishing."
        />
      </Suspense>
    </PublicLayout>
  );
}
