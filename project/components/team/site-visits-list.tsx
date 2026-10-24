'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { DataState, EmptyState, LoadingState } from '@/components/shared/states';
import { StatusBadge } from '@/components/shared/status-badge';
import { Pager } from '@/components/shared/pager';
import { selectClass } from '@/components/shared/form-field';
import { FilterBar } from '@/components/team/filter-bar';
import { SiteVisitActions } from '@/components/team/site-visit-actions';
import { Input } from '@/components/ui/input';
import { useApi } from '@/hooks/use-api';
import { qs } from '@/lib/api';
import { formatDate, formatDateTime, visitStatusBadge } from '@/lib/format';
import type { Paginated, SiteVisit } from '@/lib/types';

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const f = { status: params.get('status') ?? '', from: params.get('from') ?? '', to: params.get('to') ?? '', mine: params.get('mine') ?? '', page: params.get('page') ?? '' };
  const { data, loading, error, reload } = useApi<Paginated<SiteVisit>>(`/team/site-visits${qs(f)}`);
  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <>
      <FilterBar>
        <select className={selectClass} value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
          <option value="">All statuses</option>
          {['requested', 'scheduled', 'completed', 'cancelled', 'no_show'].map((s) => <option key={s} value={s}>{visitStatusBadge(s).label}</option>)}
        </select>
        <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From date" />
        <Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To date" />
        <select className={selectClass} value={f.mine} onChange={(e) => set({ mine: e.target.value })} aria-label="Whose visits">
          <option value="">All visits</option>
          <option value="1">My visits</option>
        </select>
      </FilterBar>
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {(d) => d.data.length === 0 ? <EmptyState title="No site visits" /> : (
          <div className="space-y-3">
            {d.data.map((v) => (
              <div key={v.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge {...visitStatusBadge(v.status)} />
                    {v.owner_confirmed && <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Owner confirmed</span>}
                  </div>
                  <p className="font-medium">
                    {v.scheduled_at ? formatDateTime(v.scheduled_at) : `Requested for ${formatDate(v.requested_date)}${v.requested_slot ? ` (${v.requested_slot})` : ''}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <Link href={`/team/leads/${v.lead_id}`} className="text-primary hover:underline">{v.lead?.name}</Link> · {v.lead?.phone} · {v.property?.title} ({v.property?.reference_code})
                  </p>
                  {v.property?.private_address && <p className="text-xs text-muted-foreground">Address: {v.property.private_address}</p>}
                  <p className="text-xs text-muted-foreground">With: {v.assignee?.name ?? 'not assigned'}</p>
                  {v.customer_feedback && <p className="text-xs">Feedback: {v.customer_feedback}</p>}
                </div>
                <SiteVisitActions visit={v} onChanged={reload} />
              </div>
            ))}
            <Pager page={d.meta.current_page} lastPage={d.meta.last_page} onChange={(p) => set({ page: String(p) })} />
          </div>
        )}
      </DataState>
    </>
  );
}

export function SiteVisitsList() {
  return <Suspense fallback={<LoadingState />}><Inner /></Suspense>;
}
