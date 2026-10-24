'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlarmClock, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DataState, EmptyState, LoadingState } from '@/components/shared/states';
import { StatusBadge } from '@/components/shared/status-badge';
import { Pager } from '@/components/shared/pager';
import { selectClass } from '@/components/shared/form-field';
import { FilterBar } from '@/components/team/filter-bar';
import { useTeamMembers } from '@/components/team/use-team-members';
import { useApi } from '@/hooks/use-api';
import { qs } from '@/lib/api';
import { formatDateTime, humanize, leadStatusBadge, timeAgo } from '@/lib/format';
import type { Lead, Paginated } from '@/lib/types';

const STATUSES = ['open', 'new', 'assigned', 'contacted', 'qualified', 'site_visit', 'negotiation', 'won', 'lost', 'cancelled'];

function LeadsListInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const members = useTeamMembers();
  const f = Object.fromEntries(['status', 'interest', 'assigned', 'q', 'follow_up', 'sort', 'page', 'from', 'to'].map((k) => [k, params.get(k) ?? '']));
  const { data, loading, error, reload } = useApi<Paginated<Lead>>(`/team/leads${qs(f)}`);

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
          <Input name="q" defaultValue={f.q} placeholder="Name, phone, email or LD-…" className="pl-9" aria-label="Search leads" />
        </form>
        <select className={selectClass} value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s === 'open' ? 'Open (active)' : humanize(s)}</option>)}
        </select>
        <select className={selectClass} value={f.assigned} onChange={(e) => set({ assigned: e.target.value })} aria-label="Assignee">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className={selectClass} value={f.interest} onChange={(e) => set({ interest: e.target.value })} aria-label="Interest">
          <option value="">Any interest</option>
          {['buy', 'rent', 'sell', 'general'].map((i) => <option key={i} value={i}>{humanize(i)}</option>)}
        </select>
        <select className={selectClass} value={f.follow_up || f.sort} onChange={(e) => {
          const v = e.target.value;
          set(v === 'today' || v === 'overdue' ? { follow_up: v, sort: 'follow_up' } : { follow_up: '', sort: v });
        }} aria-label="Sort or follow-up">
          <option value="">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="updated">Recently updated</option>
          <option value="follow_up">Next follow-up</option>
          <option value="today">Follow-up due today</option>
          <option value="overdue">Follow-up overdue</option>
        </select>
      </FilterBar>

      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {(d) => d.data.length === 0 ? (
          <EmptyState title="No leads match these filters" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Interest / Property</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3">Next follow-up</th>
                    <th className="px-4 py-3">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.data.map((lead) => {
                    const overdue = lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date();
                    return (
                      <tr key={lead.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <Link href={`/team/leads/${lead.id}`} className="font-medium text-primary hover:underline">{lead.name}</Link>
                          <p className="text-xs text-muted-foreground">{lead.reference_code} · {lead.phone}</p>
                        </td>
                        <td className="max-w-[240px] px-4 py-3">
                          <p className="capitalize">{lead.interest}</p>
                          <p className="truncate text-xs text-muted-foreground">{lead.property?.title ?? humanize(lead.source)}</p>
                        </td>
                        <td className="px-4 py-3"><StatusBadge {...leadStatusBadge(lead.status)} /></td>
                        <td className="px-4 py-3">{lead.assignee?.name ?? <span className="text-amber-700">Unassigned</span>}</td>
                        <td className="px-4 py-3">
                          {lead.next_follow_up_at ? (
                            <span className={overdue ? 'flex items-center gap-1 font-medium text-red-700' : ''}>
                              {overdue && <AlarmClock className="h-3.5 w-3.5" />}{formatDateTime(lead.next_follow_up_at)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{timeAgo(lead.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>{d.meta.total} lead{d.meta.total === 1 ? '' : 's'}</span>
              <Pager page={d.meta.current_page} lastPage={d.meta.last_page} onChange={(p) => set({ page: String(p) })} />
            </div>
          </div>
        )}
      </DataState>
    </>
  );
}

export function LeadsList() {
  return <Suspense fallback={<LoadingState />}><LeadsListInner /></Suspense>;
}
