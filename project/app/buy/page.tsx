import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PublicLayout } from '@/components/site/public-layout';
import { ListingBrowser } from '@/components/site/listing-browser';
import { LoadingState } from '@/components/shared/states';
import { serverApi } from '@/lib/server-api';
import { listingApiQuery, searchParamsSource } from '@/lib/listing-query';
import { listingPath } from '@/lib/listing-path';
import { permanentRedirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Buy Property in Ahmedabad',
  description: 'Browse reviewed residential properties for sale in Ahmedabad. Filter by locality, property type, budget, and BHK.',
  alternates: { canonical: '/buy' },
};

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function BuyPage({ searchParams }: PageProps) {
  // Old-style links (/buy?locality=shilaj&bhk=3) move to the clean search URL.
  const source = searchParamsSource(searchParams);
  if (source.get('locality') || source.get('bhk') || source.get('type')) {
    const rest = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      const v = Array.isArray(value) ? value[0] : value;
      if (v && !['locality', 'bhk', 'type', 'page'].includes(key)) rest.set(key, v);
    });
    const path = listingPath('sale', {
      locality: source.get('locality') ?? undefined,
      bhk: source.get('bhk') ?? undefined,
      type: source.get('type') ?? undefined,
    });
    permanentRedirect(rest.toString() ? `${path}?${rest}` : path);
  }

  // Render the first page of results on the server so listings are in the crawlable HTML.
  const query = listingApiQuery('sale', source);
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
