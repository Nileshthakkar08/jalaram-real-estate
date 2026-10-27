import { PublicLayout } from '@/components/site/public-layout';
import { PropertyCard } from '@/components/site/property-card';
import { EnquiryForm } from '@/components/site/enquiry-form';
import { HeroSearch } from '@/components/site/hero-search';
import { BUSINESS, whatsappLink, callLink } from '@/lib/business';
import { serverApi } from '@/lib/server-api';
import {
  MapPin, Home, KeyRound, TrendingUp, ShieldCheck,
  Phone, MessageCircle, ArrowRight, Building2, Users,
  CheckCircle2, FileText, HandshakeIcon, Headphones
} from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import Image from 'next/image';

export const revalidate = 60;

// Set here rather than in the root layout, so other pages never inherit the homepage canonical.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

async function getHomepageData() {
  const [featured, recent, localities, settings] = await Promise.all([
    serverApi.maybe(serverApi.properties('?featured=1&per_page=4')),
    serverApi.maybe(serverApi.properties('?per_page=6')),
    serverApi.maybe(serverApi.localities()),
    serverApi.settings(),
  ]);

  const recentList = recent?.data ?? [];
  const featuredList = featured?.data.length ? featured.data : recentList.slice(0, 4);
  const featuredIds = new Set(featuredList.map((p) => p.id));

  return {
    featured: featuredList,
    recent: recentList.filter((p) => !featuredIds.has(p.id)).slice(0, 3),
    totalListings: recent?.meta.total ?? 0,
    allLocalities: localities ?? [],
    // Show the areas with the most listings first on the homepage.
    localities: [...(localities ?? [])].sort((a, b) => (b.listing_count ?? 0) - (a.listing_count ?? 0)).slice(0, 6),
    settings,
    apiAvailable: recent !== null,
  };
}

export default async function HomePage() {
  const { featured, recent, totalListings, localities, allLocalities, settings } = await getHomepageData();
  const phoneHref = callLink(settings);
  const whatsappHref = whatsappLink(settings, 'Hello, I would like to discuss my property requirements.');

  return (
    <PublicLayout>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-primary">
        <div className="absolute inset-0">
          <Image
            src="https://images.pexels.com/photos/7672061/pexels-photo-7672061.jpeg?auto=compress&cs=tinysrgb&h=1080&w=1920"
            alt="Ahmedabad skyline"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/85 to-primary/70" />
        </div>

        <div className="container-mw relative container-px py-20 lg:py-32">
          <div className="mx-auto max-w-3xl text-center text-primary-foreground animate-fade-in-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent">
              <MapPin className="h-3.5 w-3.5" /> {BUSINESS.area}
            </div>
            <h1 className="text-balance font-serif text-4xl font-bold leading-tight lg:text-6xl">
              Find Your Property.
              <br />
              <span className="text-accent">Move with Confidence.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
              {BUSINESS.name} helps you buy, rent, and sell residential properties across
              Ahmedabad’s finest neighbourhoods. Listings reviewed by our team, one point of contact, and support from enquiry to handover.
            </p>

            {/* Search bar */}
            <HeroSearch localities={allLocalities} />
          </div>
        </div>
      </section>

      {/* ===== BUY / RENT / SELL ACTIONS ===== */}
      <section className="border-b border-border bg-card py-12">
        <div className="container-mw container-px">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { href: '/buy', icon: Home, title: 'Buy a Property', desc: 'Browse reviewed residential properties for sale across Ahmedabad.' },
              { href: '/rent', icon: KeyRound, title: 'Rent a Property', desc: 'Find quality rental homes in your preferred locality and budget.' },
              { href: '/sell-property', icon: TrendingUp, title: 'Sell Your Property', desc: 'List your property and reach serious buyers through our brokerage.' },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-background p-6 transition-all hover:border-accent hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 text-primary transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <action.icon className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-lg font-semibold">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.desc}</p>
                <span className="mt-auto flex items-center gap-1 text-sm font-medium text-accent">
                  Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURED PROPERTIES ===== */}
      {featured.length > 0 && (
        <section className="py-16 lg:py-20">
          <div className="container-mw container-px">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <span className="text-sm font-medium uppercase tracking-wider text-accent">Handpicked</span>
                <h2 className="mt-2 font-serif text-3xl font-bold lg:text-4xl">Featured Properties</h2>
                <p className="mt-2 text-muted-foreground">Premium listings selected by our team for their value and location.</p>
              </div>
              <Link href="/buy?featured=1" className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary hover:text-accent sm:flex">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== POPULAR NEIGHBOURHOODS ===== */}
      <section className="border-y border-border bg-secondary/30 py-16 lg:py-20">
        <div className="container-mw container-px">
          <div className="mb-10 text-center">
            <span className="text-sm font-medium uppercase tracking-wider text-accent">Explore by Area</span>
            <h2 className="mt-2 font-serif text-3xl font-bold lg:text-4xl">Popular Ahmedabad Neighbourhoods</h2>
            <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
              Discover properties in Ahmedabad’s most sought-after residential areas.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {localities.map((locality) => (
              <Link
                key={locality.id}
                href={`/areas/${locality.slug}`}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl"
              >
                {locality.image_url ? (
                  <Image
                    src={locality.image_url}
                    alt={`${locality.name}, Ahmedabad`}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent/60" aria-hidden="true" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-primary-foreground">
                  <h3 className="font-serif text-xl font-bold">{locality.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-primary-foreground/70">
                    {locality.description || `${locality.listing_count ?? 0} ${locality.listing_count === 1 ? 'listing' : 'listings'} available`}
                  </p>
                  <span className="mt-2 flex items-center gap-1 text-sm font-medium text-accent">
                    View properties <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== RECENTLY ADDED ===== */}
      {recent.length > 0 && (
        <section className="py-16 lg:py-20">
          <div className="container-mw container-px">
            <div className="mb-10">
              <span className="text-sm font-medium uppercase tracking-wider text-accent">Fresh Listings</span>
              <h2 className="mt-2 font-serif text-3xl font-bold lg:text-4xl">Recently Added</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== OWNER ACQUISITION / LIST YOUR PROPERTY ===== */}
      <section className="bg-primary py-16 lg:py-24">
        <div className="container-mw container-px">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="text-primary-foreground">
              <span className="text-sm font-medium uppercase tracking-wider text-accent">For Property Owners</span>
              <h2 className="mt-2 font-serif text-3xl font-bold lg:text-4xl">
                List Your Property in Minutes
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/80">
                Reach serious buyers and tenants through {BUSINESS.name}.
                Create your listing and upload photos — our team reviews and publishes it, then handles every enquiry, visit and negotiation for you.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Self-service owner portal',
                  'Upload up to 10 photos per listing',
                  'Track your listing status online',
                  'Our team screens buyers and tenants and arranges visits',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-primary-foreground/90">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/list-property"
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  List Your Property <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/sell-property"
                  className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/20 px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
                >
                  How It Works
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-primary-foreground/10 bg-card p-6 lg:p-8 shadow-2xl">
              <h3 className="font-serif text-xl font-bold text-foreground">Quick Enquiry</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Not ready to list? Leave your details and we’ll get in touch.
              </p>
              <div className="mt-6">
                <EnquiryForm leadType="sell" compact submitLabel="Request a Call Back" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHY CHOOSE US ===== */}
      <section className="py-16 lg:py-20">
        <div className="container-mw container-px">
          <div className="mb-10 text-center">
            <span className="text-sm font-medium uppercase tracking-wider text-accent">Our Promise</span>
            <h2 className="mt-2 font-serif text-3xl font-bold lg:text-4xl">Why Choose Jalaram Real Estate</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, title: 'Reviewed Listings', desc: 'Every listing is reviewed by our team before it goes live. A listing review is not a legal title check.' },
              { icon: Users, title: 'One Point of Contact', desc: 'Our team handles your enquiry, coordinates with the owner and arranges site visits.' },
              { icon: Building2, title: 'Local Expertise', desc: 'Deep knowledge of Ahmedabad’s neighbourhoods and property trends.' },
              { icon: HandshakeIcon, title: 'Trusted Brokerage', desc: 'Transparent dealings with clear communication and fair brokerage terms.' },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/5 text-primary">
                  <item.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 font-serif text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HELPFUL INFO / STATS ===== */}
      <section className="border-y border-border bg-secondary/30 py-16">
        <div className="container-mw container-px">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Building2, value: totalListings.toLocaleString('en-IN'), label: 'Listings Available Now' },
              { icon: MapPin, value: allLocalities.length.toLocaleString('en-IN'), label: 'Ahmedabad Localities' },
              { icon: ShieldCheck, value: 'Every', label: 'Listing Reviewed Before Publishing' },
              { icon: Headphones, value: 'One', label: 'Central Team for Every Enquiry' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="mx-auto h-8 w-8 text-accent" />
                <p className="mt-3 font-serif text-3xl font-bold text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACT CTA ===== */}
      <section className="py-16 lg:py-20">
        <div className="container-mw container-px">
          <div className="overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-sm lg:p-12">
            <h2 className="font-serif text-3xl font-bold lg:text-4xl">Ready to Find Your Next Home?</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Talk to our team today. Whether you’re buying, renting, or selling — we’re here to help you move with confidence.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {phoneHref && (
                <a
                  href={phoneHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Phone className="h-4 w-4 text-accent" /> {settings.business_phone}
                </a>
              )}
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp Us
                </a>
              )}
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <FileText className="h-4 w-4" /> Contact Form
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
