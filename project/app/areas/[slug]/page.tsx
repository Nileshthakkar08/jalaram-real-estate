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
import { listingPath } from '@/lib/listing-path';
import { cn } from '@/lib/utils';

export const revalidate = 300;

type Purpose = 'sale' | 'rent';

interface PageProps {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}

async function getLocality(slug: string) {
  try {
    return await serverApi.locality(slug);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) return null;
    throw error;
  }
}

/** Live listing counts per purpose for this area (deduplicated across metadata and page). */
async function getCounts(slug: string): Promise<Record<Purpose, number>> {
  const total = (purpose: Purpose) =>
    serverApi.maybe(serverApi.properties(`?purpose=${purpose}&locality=${encodeURIComponent(slug)}&per_page=1`))
      .then((r) => r?.meta.total ?? 0);
  const [sale, rent] = await Promise.all([total('sale'), total('rent')]);
  return { sale, rent };
}

/** Default tab is the one that has listings, so the main area URL never opens on an empty list. */
function defaultPurpose(counts: Record<Purpose, number>): Purpose {
  return counts.sale === 0 && counts.rent > 0 ? 'rent' : 'sale';
}

function chosenPurpose(searchParams: PageProps['searchParams'], fallback: Purpose): Purpose {
  const requested = searchParamsSource(searchParams).get('purpose');
  return requested === 'rent' || requested === 'sale' ? requested : fallback;
}

function countLabel(count: number, purpose: Purpose) {
  return `${count} ${count === 1 ? 'property' : 'properties'} for ${purpose}`;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const locality = await getLocality(params.slug).catch(() => null);
  if (!locality) return { title: 'Area Not Found', robots: { index: false } };

  const counts = await getCounts(locality.slug);
  const fallback = defaultPurpose(counts);
  const purpose = chosenPurpose(searchParams, fallback);
  const available = (['sale', 'rent'] as const).filter((p) => counts[p] > 0).map((p) => countLabel(counts[p], p));
  // The clean search URL (/properties-for-rent-in-shilaj-ahmedabad) is the indexed version of this view.
  const canonical = listingPath(purpose, { locality: locality.slug });

  return {
    title: `Property in ${locality.name}, Ahmedabad`,
    description: available.length
      ? `${available.join(' and ')} in ${locality.name}, Ahmedabad. Listings reviewed by Jalaram Real Estate before publishing.`
      : `Homes in ${locality.name}, Ahmedabad listed with Jalaram Real Estate.`,
    alternates: { canonical },
    // An area with no live listings has nothing unique to show yet: keep it out of the index
    // (links are still followed) until listings are published there.
    robots: counts.sale + counts.rent === 0 || counts[purpose] === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function AreaPage({ params, searchParams }: PageProps) {
  const locality = await getLocality(params.slug);
  if (!locality) notFound();

  const counts = await getCounts(locality.slug);
  const fallback = defaultPurpose(counts);
  const purpose = chosenPurpose(searchParams, fallback);
  const query = listingApiQuery(purpose, searchParamsSource(searchParams), { locality: locality.slug });
  const result = await serverApi.maybe(serverApi.properties(`?${query}`));
  const tabHref = (p: Purpose) => (p === fallback ? `/areas/${locality.slug}` : `/areas/${locality.slug}?purpose=${p}`);
  const available = (['sale', 'rent'] as const).filter((p) => counts[p] > 0).map((p) => countLabel(counts[p], p));

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
            {available.length ? `${available.join(' and ')} currently available.` : ''}
          </p>
          <div className="mt-6 inline-flex rounded-lg bg-primary-foreground/10 p-1">
            {(['sale', 'rent'] as const).map((p) => (
              <Link
                key={p}
                href={tabHref(p)}
                className={cn('rounded-md px-4 py-1.5 text-sm font-medium', purpose === p ? 'bg-accent text-accent-foreground' : 'text-primary-foreground/80 hover:text-primary-foreground')}
                aria-current={purpose === p ? 'page' : undefined}
              >
                {p === 'sale' ? 'For Sale' : 'For Rent'}{counts[p] > 0 ? ` (${counts[p]})` : ''}
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
          initial={{ query, result }}
          titleAs="h2"
          title={purpose === 'sale' ? `Properties for sale in ${locality.name}` : `Properties for rent in ${locality.name}`}
          subtitle="Filter by type, budget and BHK. Every enquiry is handled by the Jalaram team."
        />
      </Suspense>
    </PublicLayout>
  );
}
