'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { DataState, EmptyState, LoadingState } from '@/components/shared/states';
import { Pager } from '@/components/shared/pager';
import { selectClass } from '@/components/shared/form-field';
import { FilterBar } from '@/components/team/filter-bar';
import { Input } from '@/components/ui/input';
import { useApi } from '@/hooks/use-api';
import { qs } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import type { AuditLog, Paginated } from '@/lib/types';

const ENTITIES = ['Property', 'Lead', 'Deal', 'BrokerageAgreement', 'BrokeragePayment', 'BrokerageRule', 'User', 'Locality', 'Amenity'];

function show(v: unknown) {
  if (v === null || v === undefined) return '∅';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function AuditLogs() {
  const params = useSearchParams();
  const router = useRouter();
  const f = Object.fromEntries(['action', 'entity', 'entity_id', 'from', 'to', 'page'].map((k) => [k, params.get(k) ?? '']));
  const { data, loading, error, reload } = useApi<Paginated<AuditLog>>(`/admin/audit-logs${qs(f)}`);
  const set = (c: Record<string, string>) => router.push(`/admin/audit-logs${qs({ ...f, page: '', ...c })}`);

  return (
    <>
      <FilterBar>
        <form className="lg:col-span-2" onSubmit={(e) => { e.preventDefault(); set({ action: String(new FormData(e.currentTarget).get('action') ?? '') }); }}>
          <Input name="action" defaultValue={f.action} placeholder="Action prefix, e.g. brokerage." aria-label="Action" />
        </form>
        <select className={selectClass} value={f.entity} onChange={(e) => set({ entity: e.target.value })} aria-label="Entity">
          <option value="">All records</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{humanize(e.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase())}</option>)}
        </select>
        <Input type="number" placeholder="Record ID" defaultValue={f.entity_id} onBlur={(e) => set({ entity_id: e.target.value })} aria-label="Record ID" />
        <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
        <Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
      </FilterBar>
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {(d) => d.data.length === 0 ? <EmptyState title="No audit entries" /> : (
          <div className="space-y-2">
            {d.data.map((log) => (
              <div key={log.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <p><span className="font-medium">{log.action}</span> <span className="text-muted-foreground">{log.auditable_type ? `${log.auditable_type} #${log.auditable_id}` : ''}</span></p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(log.created_at)} · {log.user ? `${log.user.name} (${humanize(log.user.role)})` : 'System / public'} · {log.ip_address}</p>
                </div>
                {log.reason && <p className="mt-1">Reason: {log.reason}</p>}
                {(log.old_values || log.new_values) && (
                  <ul className="mt-1 space-y-0.5 break-all text-xs text-muted-foreground">
                    {Object.keys({ ...(log.old_values ?? {}), ...(log.new_values ?? {}) }).map((k) => (
                      <li key={k}><span className="font-medium text-foreground">{k}</span>: {log.old_values && k in log.old_values ? `${show(log.old_values[k])} → ` : ''}{show(log.new_values?.[k])}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <Pager page={d.meta.current_page} lastPage={d.meta.last_page} onChange={(p) => set({ page: String(p) })} />
          </div>
        )}
      </DataState>
    </>
  );
}

export default function AuditLogsPage() {
  return (
    <>
      <PageHeader title="Audit logs" description="Every sensitive change: roles, moderation, brokerage rules, agreements, payments and settings." />
      <Suspense fallback={<LoadingState />}><AuditLogs /></Suspense>
    </>
  );
}
