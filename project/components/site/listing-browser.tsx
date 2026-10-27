'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PropertyCard } from '@/components/site/property-card';
import { Pager } from '@/components/shared/pager';
import { Loader2, Search, SlidersHorizontal, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { api, errorMessage } from '@/lib/api';
import type { Locality, Paginated, PublicProperty } from '@/lib/types';
import { PROPERTY_TYPES, FURNISHING_TYPES, formatPriceShort } from '@/lib/format';
import { listingApiQuery } from '@/lib/listing-query';

interface ListingBrowserProps {
  listingType: 'sale' | 'rent';
  title: string;
  subtitle: string;
  /** Fix the locality (area landing pages). */
  fixedLocality?: string;
  localities?: Locality[];
  /** Server-rendered first page, so listings are in the HTML crawlers receive. */
  initial?: { query: string; result: Paginated<PublicProperty> | null };
  /** Use h2 when the page already has its own h1 (area pages). */
  titleAs?: 'h1' | 'h2';
}

const FILTER_KEYS = ['locality', 'type', 'bhk', 'min_price', 'max_price', 'furnishing', 'q'] as const;

export function ListingBrowser({ listingType, title, subtitle, fixedLocality, localities: initialLocalities, initial, titleAs = 'h1' }: ListingBrowserProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [result, setResult] = useState<Paginated<PublicProperty> | null>(initial?.result ?? null);
  const [localities, setLocalities] = useState<Locality[]>(initialLocalities ?? []);
  const [loading, setLoading] = useState(!initial?.result);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const locality = fixedLocality ?? searchParams.get('locality') ?? '';
  const propertyType = searchParams.get('type') ?? '';
  const bhk = searchParams.get('bhk') ?? '';
  const minPrice = searchParams.get('min_price') ?? '';
  const maxPrice = searchParams.get('max_price') ?? '';
  const furnishing = searchParams.get('furnishing') ?? '';
  const q = searchParams.get('q') ?? '';
  const sort = searchParams.get('sort') ?? 'newest';

  // Local state for free-text inputs so typing doesn't navigate on every keystroke.
  const [draft, setDraft] = useState({ min_price: minPrice, max_price: maxPrice, q });
  useEffect(() => setDraft({ min_price: minPrice, max_price: maxPrice, q }), [minPrice, maxPrice, q]);

  useEffect(() => {
    if (initialLocalities?.length) return;
    api.get<{ data: Locality[] }>('/localities').then((r) => setLocalities(r.data)).catch(() => setLocalities([]));
  }, [initialLocalities]);

  const query = useMemo(
    () => listingApiQuery(listingType, searchParams, fixedLocality),
    [listingType, searchParams, fixedLocality]
  );
  // Skip the first browser fetch when the server already rendered this exact query.
  const skipFetch = useRef(!!initial?.result && initial.query === query);

  useEffect(() => {
    if (skipFetch.current) {
      skipFetch.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get<Paginated<PublicProperty>>(`/properties?${query}`)
      .then((res) => { if (!cancelled) setResult(res); })
      .catch((e) => { if (!cancelled) setError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, reloadKey]);

  const updateFilters = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => (value ? params.set(key, value) : params.delete(key)));
    if (!('page' in changes)) params.delete('page');
    const s = params.toString();
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: 'page' in changes });
  };
  const updateFilter = (key: string, value: string) => updateFilters({ [key]: value });

  const applyDraft = () => updateFilters({ min_price: draft.min_price, max_price: draft.max_price, q: draft.q.trim() });

  const clearFilters = () => {
    router.push(pathname);
  };

  const hasFilters = FILTER_KEYS.some((k) => k !== 'locality' || !fixedLocality ? !!searchParams.get(k) : false);
  const count = result?.meta.total ?? 0;

  const FilterContent = () => (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        applyDraft();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="filter-q">Keyword</Label>
        <Input id="filter-q" placeholder="Area, landmark or reference" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
      </div>

      {!fixedLocality && (
        <div className="space-y-1.5">
          <Label>Locality</Label>
          <Select value={locality || 'all'} onValueChange={(v) => updateFilter('locality', v === 'all' ? '' : v)}>
            <SelectTrigger aria-label="Locality"><SelectValue placeholder="Any locality" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any locality</SelectItem>
              {localities.map((l) => (
                <SelectItem key={l.id} value={l.slug}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Property Type</Label>
        <Select value={propertyType || 'all'} onValueChange={(v) => updateFilter('type', v === 'all' ? '' : v)}>
          <SelectTrigger aria-label="Property type"><SelectValue placeholder="Any type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any type</SelectItem>
            {PROPERTY_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>BHK</Label>
        <Select value={bhk || 'all'} onValueChange={(v) => updateFilter('bhk', v === 'all' ? '' : v)}>
          <SelectTrigger aria-label="Bedrooms"><SelectValue placeholder="Any BHK" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any BHK</SelectItem>
            {[1, 2, 3, 4].map((n) => (
              <SelectItem key={n} value={n.toString()}>{n} BHK</SelectItem>
            ))}
            <SelectItem value="5">5+ BHK</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-min">Min {listingType === 'rent' ? 'Rent' : 'Price'} (₹)</Label>
          <Input
            id="filter-min"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="0"
            value={draft.min_price}
            onChange={(e) => setDraft({ ...draft, min_price: e.target.value })}
            onBlur={applyDraft}
          />
          {draft.min_price && <p className="text-xs text-muted-foreground">{formatPriceShort(draft.min_price)}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-max">Max {listingType === 'rent' ? 'Rent' : 'Price'} (₹)</Label>
          <Input
            id="filter-max"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="No limit"
            value={draft.max_price}
            onChange={(e) => setDraft({ ...draft, max_price: e.target.value })}
            onBlur={applyDraft}
          />
          {draft.max_price && <p className="text-xs text-muted-foreground">{formatPriceShort(draft.max_price)}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Furnishing</Label>
        <Select value={furnishing || 'all'} onValueChange={(v) => updateFilter('furnishing', v === 'all' ? '' : v)}>
          <SelectTrigger aria-label="Furnishing"><SelectValue placeholder="Any furnishing" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any furnishing</SelectItem>
            {FURNISHING_TYPES.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Sort By</Label>
        <Select value={sort} onValueChange={(v) => updateFilter('sort', v === 'newest' ? '' : v)}>
          <SelectTrigger aria-label="Sort by"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
            <SelectItem value="area_desc">Largest Area</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full gap-2">
        <Search className="h-4 w-4" /> Apply
      </Button>
      {hasFilters && (
        <Button type="button" variant="outline" onClick={clearFilters} className="w-full gap-2">
          <X className="h-4 w-4" /> Clear Filters
        </Button>
      )}
    </form>
  );

  return (
    <div className="container-mw container-px py-10 lg:py-14">
      {/* Header */}
      <div className="mb-8">
        {titleAs === 'h1' ? (
          <h1 className="font-serif text-3xl font-bold lg:text-4xl">{title}</h1>
        ) : (
          <h2 className="font-serif text-3xl font-bold lg:text-4xl">{title}</h2>
        )}
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Desktop sidebar filters */}
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-accent" />
              <h2 className="font-serif text-lg font-semibold">Filters</h2>
            </div>
            <FilterContent />
          </div>
        </aside>

        {/* Mobile filter button */}
        <div className="flex items-center justify-between lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Filters
                {hasFilters && <span className="ml-1 h-2 w-2 rounded-full bg-accent" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterContent />
              </div>
            </SheetContent>
          </Sheet>
          <span className="text-sm text-muted-foreground" aria-live="polite">{loading ? 'Searching…' : `${count} results`}</span>
        </div>

        {/* Results */}
        <div>
          <div className="mb-4 hidden items-center justify-between lg:flex">
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {loading ? 'Searching…' : `${count} ${count === 1 ? 'property' : 'properties'} found`}
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-[400px] items-center justify-center" role="status" aria-label="Loading properties">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : error ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-card p-6 text-center" role="alert">
              <AlertTriangle className="h-10 w-10 text-destructive/70" />
              <h3 className="mt-4 font-serif text-lg font-semibold">We couldn&apos;t load properties</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)} className="mt-4 gap-2">
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            </div>
          ) : !result || result.data.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <Search className="h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 font-serif text-lg font-semibold">No properties found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFilters ? 'Try adjusting your filters or search criteria.' : 'New listings are added after our team reviews them. Please check back soon or send us your requirement.'}
              </p>
              {hasFilters && (
                <Button variant="outline" onClick={clearFilters} className="mt-4 gap-2">
                  <X className="h-4 w-4" /> Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {result.data.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
              <Pager
                className="mt-8"
                page={result.meta.current_page}
                lastPage={result.meta.last_page}
                onChange={(p) => updateFilter('page', p === 1 ? '' : String(p))}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
