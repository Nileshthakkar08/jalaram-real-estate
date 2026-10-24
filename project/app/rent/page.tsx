import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PublicLayout } from '@/components/site/public-layout';
import { ListingBrowser } from '@/components/site/listing-browser';
import { LoadingState } from '@/components/shared/states';

export const metadata: Metadata = {
  title: 'Rent Property in Ahmedabad',
  description: 'Browse residential properties for rent in Ahmedabad. Filter by locality, property type, budget, furnishing, and BHK.',
  alternates: { canonical: '/rent' },
};

export default function RentPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<LoadingState label="Loading properties" />}>
        <ListingBrowser
          listingType="rent"
          title="Properties for Rent in Ahmedabad"
          subtitle="Find quality rental homes in your preferred locality and budget across Ahmedabad."
        />
      </Suspense>
    </PublicLayout>
  );
}
