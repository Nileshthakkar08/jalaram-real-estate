'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DataState, EmptyState, LoadingState } from '@/components/shared/states';
import { StatusBadge } from '@/components/shared/status-badge';
import { Pager } from '@/components/shared/pager';
import { selectClass } from '@/components/shared/form-field';
import { FilterBar } from '@/components/team/filter-bar';
import { useApi } from '@/hooks/use-api';
import { qs } from '@/lib/api';
import { dealStatusBadge, formatMoney, formatPrice } from '@/lib/format';
import type { Deal, Paginated } from '@/lib/types';

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const f = Object.fromEntries(['status', 'type', 'payment', 'q', 'page'].map((k) => [k, params.get(k) ?? '']));
  const { data, loading, error, reload } = useApi<Paginated<Deal>>(`/team/deals${qs(f)}`);
  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <>
      <FilterBar>
        <form className="relative lg:col-span-2" onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get('q') ?? '') }); }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={f.q} placeholder="Customer, property or DL-…" className="pl-9" aria-label="Search deals" />
        </form>
        <select className={selectClass} value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          {['negotiation', 'agreement_pending', 'closed_won', 'closed_lost', 'cancelled'].map((s) => <option key={s} value={s}>{dealStatusBadge(s).label}</option>)}
        </select>
        <select className={selectClass} value={f.type} onChange={(e) => set({ type: e.target.value })} aria-label="Type">
          <option value="">Sale and rent</option>
          <option value="sale">Sale</option>
          <option value="rent">Rent</option>
        </select>
        <select className={selectClass} value={f.payment} onChange={(e) => set({ payment: e.target.value })} aria-label="Brokerage">
          <option value="">Any brokerage state</option>
          <option value="outstanding">Brokerage outstanding</option>
          <option value="paid">Fully collected</option>
        </select>
      </FilterBar>
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {(d) => d.data.length === 0 ? <EmptyState title="No deals" description="Deals are opened from a lead once negotiation starts." /> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Deal</th>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Final price</th>
                    <th className="px-4 py-3 text-right">Agreed brokerage</th>
                    <th className="px-4 py-3 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.data.map((deal) => (
                    <tr key={deal.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link href={`/team/deals/${deal.id}`} className="font-medium text-primary hover:underline">{deal.reference_code}</Link>
                        <p className="text-xs text-muted-foreground">{deal.customer_name} · {deal.assignee?.name ?? 'Unassigned'}</p>
                      </td>
                      <td className="max-w-[240px] px-4 py-3">
                        <p className="truncate">{deal.property?.title}</p>
                        <p className="text-xs capitalize text-muted-foreground">{deal.transaction_type} · {deal.property?.locality}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge {...dealStatusBadge(deal.status)} /></td>
                      <td className="px-4 py-3 text-right tabular-nums">{deal.final_price ? formatPrice(deal.final_price, deal.transaction_type) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMoney(deal.totals?.agreed)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(deal.totals?.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>{d.meta.total} deal{d.meta.total === 1 ? '' : 's'}</span>
              <Pager page={d.meta.current_page} lastPage={d.meta.last_page} onChange={(p) => set({ page: String(p) })} />
            </div>
          </div>
        )}
      </DataState>
    </>
  );
}

export function DealsList() {
  return <Suspense fallback={<LoadingState />}><Inner /></Suspense>;
}
