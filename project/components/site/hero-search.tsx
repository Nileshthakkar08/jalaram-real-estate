'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { Locality } from '@/lib/types';
import { PROPERTY_TYPES, RENT_BUDGETS, SALE_BUDGETS } from '@/lib/format';
import { cn } from '@/lib/utils';

const selectClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-ring';

/** Homepage search. Submits to /buy or /rent with shareable query parameters. */
export function HeroSearch({ localities }: { localities: Locality[] }) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<'sale' | 'rent'>('sale');
  const budgets = purpose === 'rent' ? RENT_BUDGETS : SALE_BUDGETS;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    ['locality', 'type', 'bhk'].forEach((key) => {
      const value = String(fd.get(key) ?? '');
      if (value) params.set(key, value);
    });
    const [min, max] = String(fd.get('budget') ?? '').split('-');
    if (min && min !== '0') params.set('min_price', min);
    if (max) params.set('max_price', max);
    const query = params.toString();
    router.push(`/${purpose === 'rent' ? 'rent' : 'buy'}${query ? `?${query}` : ''}`);
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-2xl rounded-2xl border border-primary-foreground/15 bg-card p-4 text-left shadow-2xl lg:p-6" role="search">
      <div className="mb-4 inline-flex rounded-lg bg-muted p-1" role="radiogroup" aria-label="Buy or rent">
        {(['sale', 'rent'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={purpose === value}
            onClick={() => setPurpose(value)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              purpose === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {value === 'sale' ? 'Buy' : 'Rent'}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor="hero-locality" className="text-xs font-medium text-muted-foreground">Locality</label>
          <select id="hero-locality" name="locality" className={selectClass}>
            <option value="">Any locality</option>
            {localities.map((l) => (
              <option key={l.id} value={l.slug}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="hero-type" className="text-xs font-medium text-muted-foreground">Property Type</label>
          <select id="hero-type" name="type" className={selectClass}>
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="hero-budget" className="text-xs font-medium text-muted-foreground">{purpose === 'rent' ? 'Monthly Rent' : 'Budget'}</label>
          <select id="hero-budget" name="budget" key={purpose} className={selectClass}>
            <option value="">Any budget</option>
            {budgets.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="hero-bhk" className="text-xs font-medium text-muted-foreground">BHK</label>
          <select id="hero-bhk" name="bhk" className={selectClass}>
            <option value="">Any BHK</option>
            <option value="1">1 BHK</option>
            <option value="2">2 BHK</option>
            <option value="3">3 BHK</option>
            <option value="4">4 BHK</option>
            <option value="5">5+ BHK</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Search className="h-4 w-4 text-accent" /> Search Properties
      </button>
    </form>
  );
}
