'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlusCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState, EmptyState, LoadingState } from '@/components/shared/states';
import { Pager } from '@/components/shared/pager';
import { OwnerPropertyRow } from '@/components/property/owner-property-row';
import { Button } from '@/components/ui/button';
import { useApi } from '@/hooks/use-api';
import { qs } from '@/lib/api';
import { listingStatusLabels } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ManagedProperty, Paginated } from '@/lib/types';

const FILTERS = ['', 'draft', 'pending', 'published', 'rejected', 'unavailable', 'expired', 'closed', 'suspended'];

function OwnerProperties() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const { data, loading, error, reload } = useApi<Paginated<ManagedProperty>>(`/owner/properties${qs({ status, page })}`);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {FILTERS.map((s) => (
          <button
            key={s || 'all'}
            role="tab"
            aria-selected={status === s}
            onClick={() => router.push(`/dashboard/properties${qs({ status: s })}`)}
            className={cn('rounded-full border px-3 py-1 text-sm', status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
          >
            {s ? listingStatusLabels(s).label : 'All'}
          </button>
        ))}
      </div>
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {(d) => d.data.length === 0 ? (
          <EmptyState
            title={status ? 'No listings with this status' : 'No listings yet'}
            action={<Button asChild><Link href="/dashboard/properties/new">Create a listing</Link></Button>}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card px-3">
            <ul className="divide-y divide-border">{d.data.map((p) => <OwnerPropertyRow key={p.id} property={p} />)}</ul>
            <Pager className="py-4" page={d.meta.current_page} lastPage={d.meta.last_page} onChange={(p) => router.push(`/dashboard/properties${qs({ status, page: p })}`)} />
          </div>
        )}
      </DataState>
    </>
  );
}

export default function OwnerPropertiesPage() {
  return (
    <>
      <PageHeader
        title="My Listings"
        description="Drafts are private. Submitted listings are reviewed by Jalaram before they go live."
        actions={<Button asChild className="gap-2"><Link href="/dashboard/properties/new"><PlusCircle className="h-4 w-4" /> Add listing</Link></Button>}
      />
      <Suspense fallback={<LoadingState />}>
        <OwnerProperties />
      </Suspense>
    </>
  );
}
