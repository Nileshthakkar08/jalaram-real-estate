import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { PublicLayout } from '@/components/site/public-layout';
import { ListingBrowser } from '@/components/site/listing-browser';
import { LoadingState } from '@/components/shared/states';
import { serverApi, ServerApiError } from '@/lib/server-api';
import { cn } from '@/lib/utils';

export const revalidate = 300;

interface PageProps {
  params: { slug: string };
  searchParams: { purpose?: string };
}

async function getLocality(slug: string) {
  try {
    return await serverApi.locality(slug);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locality = await getLocality(params.slug).catch(() => null);
  if (!locality) return { title: 'Area Not Found', robots: { index: false } };

  return {
    title: `Property in ${locality.name}, Ahmedabad`,
    description: `Flats, houses and villas for sale and rent in ${locality.name}, Ahmedabad. Listings reviewed by Jalaram Real Estate before publishing.`,
    alternates: { canonical: `/areas/${locality.slug}` },
  };
}

export default async function AreaPage({ params, searchParams }: PageProps) {
  const locality = await getLocality(params.slug);
  if (!locality) notFound();
  const purpose = searchParams.purpose === 'rent' ? 'rent' : 'sale';

  return (
    <PublicLayout>
      <section className="bg-primary py-12 lg:py-16">
        <div className="container-mw container-px text-primary-foreground">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-primary-foreground/70">
            <Link href="/" className="flex items-center gap-1 hover:text-primary-foreground"><Home className="h-3.5 w-3.5" /> Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span aria-current="page">{locality.name}</span>
          </nav>
          <h1 className="mt-4 font-serif text-3xl font-bold lg:text-5xl">Property in {locality.name}</h1>
          <p className="mt-3 max-w-2xl text-primary-foreground/80">
            {locality.description || `Homes for sale and rent in ${locality.name}, ${locality.city}.`}{' '}
            {locality.listing_count ? `${locality.listing_count} listing${locality.listing_count === 1 ? '' : 's'} currently available.` : ''}
          </p>
          <div className="mt-6 inline-flex rounded-lg bg-primary-foreground/10 p-1">
            {(['sale', 'rent'] as const).map((p) => (
              <Link
                key={p}
                href={p === 'sale' ? `/areas/${locality.slug}` : `/areas/${locality.slug}?purpose=rent`}
                className={cn('rounded-md px-4 py-1.5 text-sm font-medium', purpose === p ? 'bg-accent text-accent-foreground' : 'text-primary-foreground/80 hover:text-primary-foreground')}
                aria-current={purpose === p ? 'page' : undefined}
              >
                {p === 'sale' ? 'For Sale' : 'For Rent'}
              </Link>
            ))}
          </div>
        </div>
      </section>
      <Suspense fallback={<LoadingState label="Loading properties" />}>
        <ListingBrowser
          key={purpose}
          listingType={purpose}
          fixedLocality={locality.slug}
          title={purpose === 'sale' ? `Properties for sale in ${locality.name}` : `Properties for rent in ${locality.name}`}
          subtitle="Filter by type, budget and BHK. Every enquiry is handled by the Jalaram team."
        />
      </Suspense>
    </PublicLayout>
  );
}
