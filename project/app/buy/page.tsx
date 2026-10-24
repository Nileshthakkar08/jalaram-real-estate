import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PublicLayout } from '@/components/site/public-layout';
import { ListingBrowser } from '@/components/site/listing-browser';
import { LoadingState } from '@/components/shared/states';

export const metadata: Metadata = {
  title: 'Buy Property in Ahmedabad',
  description: 'Browse reviewed residential properties for sale in Ahmedabad. Filter by locality, property type, budget, and BHK.',
  alternates: { canonical: '/buy' },
};

export default function BuyPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<LoadingState label="Loading properties" />}>
        <ListingBrowser
          listingType="sale"
          title="Properties for Sale in Ahmedabad"
          subtitle="Browse residential properties for sale across Ahmedabad’s finest neighbourhoods, reviewed by our team before publishing."
        />
      </Suspense>
    </PublicLayout>
  );
}
