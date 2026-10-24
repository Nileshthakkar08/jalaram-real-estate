import { PublicLayout } from '@/components/site/public-layout';
import { PropertyCard } from '@/components/site/property-card';
import { PropertyGallery } from '@/components/site/property-gallery';
import { PropertyContactPanel } from '@/components/site/property-contact-panel';
import { serverApi, ServerApiError } from '@/lib/server-api';
import { formatPrice, formatDate, propertyTypeLabel, humanize } from '@/lib/format';
import {
  MapPin, Maximize, BedDouble, Bath, CheckCircle2, Sofa, Car, Zap, ShieldCheck,
  ChevronRight, Home, Building2, CalendarDays, Info
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { PublicProperty } from '@/lib/types';

export const revalidate = 60;

interface PageProps {
  params: { slug: string };
}

async function getProperty(slug: string) {
  try {
    return await serverApi.property(slug);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await getProperty(params.slug).catch(() => null);
  if (!result) {
    return { title: 'Property Not Found', robots: { index: false } };
  }
  const property = result.data;
  const description = `${property.listing_purpose === 'sale' ? 'For sale' : 'For rent'}: ${property.title} in ${property.locality?.name ?? 'Ahmedabad'}. ${(property.description ?? '').slice(0, 120)}`;
  const image = property.images?.[0]?.url;

  return {
    title: property.title,
    description,
    alternates: { canonical: `/property/${property.slug}` },
    openGraph: {
      title: property.title,
      description,
      type: 'website',
      images: image ? [{ url: image }] : [],
    },
  };
}

function structuredData(property: PublicProperty) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.description,
    url: `${siteUrl}/property/${property.slug}`,
    datePosted: property.published_at,
    image: property.images?.map((i) => i.url),
    offers: {
      '@type': 'Offer',
      price: Number(property.price),
      priceCurrency: 'INR',
      businessFunction: property.listing_purpose === 'rent' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell',
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.locality?.name,
      addressRegion: 'Gujarat',
      addressCountry: 'IN',
    },
  };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const result = await getProperty(params.slug);
  if (!result) notFound();
  const { data: property, similar } = result;

  const images = property.images ?? [];
  const purposeHref = property.listing_purpose === 'sale' ? '/buy' : '/rent';

  const amenityIcons: Record<string, React.ElementType> = {
    lift: Zap,
    parking: Car,
    security: ShieldCheck,
    garden: Building2,
    'modular-kitchen': Sofa,
  };

  const specs = [
    { label: 'Floor', value: property.floor_number !== null && property.floor_number !== undefined ? `${property.floor_number}${property.total_floors ? ` of ${property.total_floors}` : ''}` : null },
    { label: 'Balconies', value: property.balconies },
    { label: 'Facing', value: property.facing ? humanize(property.facing) : null },
    { label: 'Property age', value: property.property_age_years !== null && property.property_age_years !== undefined ? `${property.property_age_years} years` : null },
    { label: 'Available from', value: property.available_from ? formatDate(property.available_from) : null },
    { label: 'Security deposit', value: property.security_deposit ? formatPrice(property.security_deposit) : null },
    { label: 'Maintenance', value: property.maintenance_charges ? `${formatPrice(property.maintenance_charges)}/mo` : null },
  ].filter((s) => s.value !== null && s.value !== undefined && s.value !== '');

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(property)).replace(/</g, '\\u003c') }}
      />

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="border-b border-border bg-card">
        <div className="container-mw container-px flex items-center gap-1.5 py-3 text-sm text-muted-foreground">
          <Link href="/" className="flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" /> Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={purposeHref} className="hover:text-primary">
            {property.listing_purpose === 'sale' ? 'Buy' : 'Rent'}
          </Link>
          {property.locality && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href={`/areas/${property.locality.slug}`} className="hover:text-primary">{property.locality.name}</Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate text-primary" aria-current="page">{property.title}</span>
        </div>
      </nav>

      {/* Gallery */}
      <div className="container-mw container-px py-6 lg:py-8">
        <PropertyGallery images={images} title={property.title} />
      </div>

      {/* Main content */}
      <div className="container-mw container-px pb-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left: Details */}
          <div className="space-y-8">
            {/* Title + price */}
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  {property.listing_purpose === 'sale' ? 'For Sale' : 'For Rent'}
                </span>
                <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {propertyTypeLabel(property.property_type)}
                </span>
                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  Available
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  Ref: {property.reference_code}
                </span>
              </div>
              <h1 className="mt-3 font-serif text-2xl font-bold leading-tight lg:text-3xl">{property.title}</h1>
              <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-accent" />
                <span>{property.public_address}{property.locality ? `, ${property.locality.name}` : ''}, Ahmedabad</span>
              </div>
              <p className="mt-4 font-serif text-3xl font-bold text-primary lg:text-4xl">
                {formatPrice(property.price, property.listing_purpose)}
                {property.price_negotiable && <span className="ml-2 align-middle text-sm font-medium text-muted-foreground">Negotiable</span>}
              </p>
              {property.listing_purpose === 'rent' && (
                <p className="mt-1 text-sm text-muted-foreground">Monthly rent{property.security_deposit ? ` · ${formatPrice(property.security_deposit)} security deposit` : ''}</p>
              )}
            </div>

            {/* Key specs */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-4">
              {[
                { icon: BedDouble, label: 'Bedrooms', value: property.bedrooms ?? '—' },
                { icon: Bath, label: 'Bathrooms', value: property.bathrooms ?? '—' },
                { icon: Maximize, label: 'Area', value: `${property.area_sqft.toLocaleString('en-IN')} sq ft` },
                { icon: Sofa, label: 'Furnishing', value: property.furnishing ? humanize(property.furnishing) : '—' },
              ].map((spec) => (
                <div key={spec.label} className="text-center">
                  <spec.icon className="mx-auto h-6 w-6 text-accent" />
                  <p className="mt-2 text-lg font-semibold capitalize">{spec.value}</p>
                  <p className="text-xs text-muted-foreground">{spec.label}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <h2 className="font-serif text-xl font-semibold">About this property</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{property.description}</p>
            </div>

            {/* Specifications */}
            {specs.length > 0 && (
              <div>
                <h2 className="font-serif text-xl font-semibold">Specifications</h2>
                <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
                  {specs.map((spec) => (
                    <div key={spec.label} className="flex justify-between border-b border-border py-2.5">
                      <dt className="text-sm text-muted-foreground">{spec.label}</dt>
                      <dd className="text-sm font-medium">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div>
                <h2 className="font-serif text-xl font-semibold">Amenities</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {property.amenities.map((amenity) => {
                    const Icon = amenityIcons[amenity.slug] ?? CheckCircle2;
                    return (
                      <div key={amenity.slug} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                        <Icon className="h-4 w-4 text-accent" />
                        <span className="text-sm">{amenity.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* How it works / brokerage */}
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
              <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><Info className="h-5 w-5 text-accent" /> How Jalaram handles this listing</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>• Send an enquiry or visit request — it goes to our central team, not directly to the owner.</li>
                <li>• We confirm your requirement, check availability with the owner and schedule a site visit.</li>
                <li>• We support negotiation and documentation through to agreement.</li>
                <li>• Brokerage applies only when a transaction is completed. The amount and who pays are agreed in writing before the deal closes — ask our team for details.</li>
              </ul>
            </div>

            {/* Listing details */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-serif text-lg font-semibold">Listing Details</h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-sm text-muted-foreground">Reference ID</dt>
                  <dd className="text-sm font-medium">{property.reference_code}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-sm text-muted-foreground">Property Type</dt>
                  <dd className="text-sm font-medium">{propertyTypeLabel(property.property_type)}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-sm text-muted-foreground">Listing Type</dt>
                  <dd className="text-sm font-medium">{property.listing_purpose === 'sale' ? 'Sale' : 'Rent'}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-sm text-muted-foreground">Locality</dt>
                  <dd className="text-sm font-medium">{property.locality?.name ?? '—'}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2 sm:border-0">
                  <dt className="flex items-center gap-1 text-sm text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Published</dt>
                  <dd className="text-sm font-medium">{formatDate(property.published_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Last Updated</dt>
                  <dd className="text-sm font-medium">{formatDate(property.updated_at)}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Right: Sticky sidebar */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PropertyContactPanel property={property} />

            {/* Disclaimer */}
            <p className="mt-4 text-xs text-muted-foreground">
              Listing details are provided by the owner and reviewed by our team before publishing. This review is not a legal
              title verification — please verify ownership documents before any payment or agreement.
            </p>
          </div>
        </div>

        {/* Similar properties */}
        {similar.length > 0 && (
          <div className="mt-16">
            <h2 className="font-serif text-2xl font-bold">Similar Properties</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
