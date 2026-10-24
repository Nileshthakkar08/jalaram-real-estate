'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { DataState, EmptyState, LoadingState } from '@/components/shared/states';
import { Pager } from '@/components/shared/pager';
import { selectClass } from '@/components/shared/form-field';
import { OwnerPropertyRow } from '@/components/property/owner-property-row';
import { FilterBar } from '@/components/team/filter-bar';
import { Input } from '@/components/ui/input';
import { useApi } from '@/hooks/use-api';
import { qs } from '@/lib/api';
import { listingStatusLabels } from '@/lib/format';
import type { ManagedProperty, Paginated } from '@/lib/types';

function Properties({ basePath, detailBase, endpoint }: { basePath: string; detailBase: string; endpoint: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const f = Object.fromEntries(['status', 'purpose', 'q', 'page'].map((k) => [k, params.get(k) ?? '']));
  const { data, loading, error, reload } = useApi<Paginated<ManagedProperty>>(`${endpoint}${qs(f)}`);
  const set = (changes: Record<string, string>) => router.push(`${basePath}${qs({ ...f, page: '', ...changes })}`);

  return (
    <>
      <FilterBar>
        <form className="relative lg:col-span-3" onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get('q') ?? '') }); }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={f.q} placeholder="Title, reference, owner…" className="pl-9" aria-label="Search properties" />
        </form>
        <select className={selectClass} value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
          <option value="">All statuses</option>
          {['pending', 'published', 'rejected', 'unavailable', 'expired', 'closed', 'suspended', 'draft'].map((s) => <option key={s} value={s}>{listingStatusLabels(s).label}</option>)}
        </select>
        <select className={selectClass} value={f.purpose} onChange={(e) => set({ purpose: e.target.value })} aria-label="Purpose">
          <option value="">Sale and rent</option><option value="sale">Sale</option><option value="rent">Rent</option>
        </select>
      </FilterBar>
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {(d) => d.data.length === 0 ? <EmptyState title="No properties found" /> : (
          <div className="rounded-xl border border-border bg-card px-3">
            <ul className="divide-y divide-border">
              {d.data.map((p) => (
                <OwnerPropertyRow
                  key={p.id}
                  property={p}
                  href={`${detailBase}/${p.id}`}
                  extra={`Owner: ${p.owner?.name ?? '—'} · ${p.leads_count ?? 0} leads · ${p.deals_count ?? 0} deals`}
                />
              ))}
            </ul>
            <Pager className="py-4" page={d.meta.current_page} lastPage={d.meta.last_page} onChange={(pg) => set({ page: String(pg) })} />
          </div>
        )}
      </DataState>
    </>
  );
}

export function PropertiesBrowser(props: { basePath: string; detailBase: string; endpoint: string }) {
  return <Suspense fallback={<LoadingState />}><Properties {...props} /></Suspense>;
}

