'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/shared/stat-card';
import { Section } from '@/components/shared/section';
import { DataState } from '@/components/shared/states';
import { useApi } from '@/hooks/use-api';
import { qs } from '@/lib/api';
import { formatMoney, formatPriceShort, todayISO } from '@/lib/format';
import type { FinanceReport, FinanceRow } from '@/lib/types';

function firstOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

function Breakdown({ title, rows }: { title: string; rows: FinanceRow[] }) {
  return (
    <Section title={title}>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No brokerage in this period.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="py-2"> </th><th className="py-2 text-right">Agreed</th><th className="py-2 text-right">Collected</th><th className="py-2 text-right">Outstanding</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={String(r.key)}>
                  <td className="py-2 capitalize">{r.label}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(r.agreed)}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(r.collected)}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(r.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/**
 * Brokerage report. Each figure is a separate layer — estimate, agreement, invoice, cash —
 * and property prices are never counted as Jalaram revenue.
 */
export function FinanceReportView({ endpoint }: { endpoint: '/team/brokerage/summary' | '/admin/reports/finance' }) {
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(todayISO());
  const { data, loading, error, reload } = useApi<{ data: FinanceReport }>(`${endpoint}${qs({ from, to })}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="space-y-1">
          <Label htmlFor="fr-from">From</Label>
          <Input id="fr-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fr-to">To</Label>
          <Input id="fr-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        {data?.data.scope === 'own_deals' && <p className="pb-2 text-xs text-muted-foreground">Showing your deals only.</p>}
      </div>

      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {({ data: r }) => (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Collected (net)" value={formatMoney(r.totals.collected)} tone="success" hint="Payments received minus refunds, in this period" />
              <StatCard label="Outstanding" value={formatMoney(r.totals.outstanding)} tone="warning" hint="Unpaid agreed brokerage on closed deals (now)" />
              <StatCard label="Agreed" value={formatMoney(r.totals.agreed)} hint="Brokerage agreed with parties in this period" />
              <StatCard label="Potential" value={formatMoney(r.totals.potential)} hint="Rule estimates on open deals — not revenue" />
              <StatCard label="Invoiced" value={formatMoney(r.totals.invoiced)} hint="Invoice amounts dated in this period" />
              <StatCard label="Refunded" value={formatMoney(r.totals.refunded)} />
              <StatCard label="Waived" value={formatMoney(r.totals.waived)} />
              <StatCard label="Agreed, deal still open" value={formatMoney(r.totals.agreed_pending_closure)} hint="Not yet receivable" />
            </div>

            <Section title="By month">
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <BarChart data={r.by_month.map((m) => ({ month: m.month, Agreed: Number(m.agreed), Collected: Number(m.collected) }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(v) => formatPriceShort(v)} width={70} />
                    <Tooltip formatter={(v: number) => formatMoney(v)} />
                    <Legend />
                    <Bar dataKey="Agreed" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Collected" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <div className="grid gap-6 lg:grid-cols-3">
              <Breakdown title="Rent vs sale" rows={r.by_transaction_type} />
              <Breakdown title="By team member" rows={r.by_team_member} />
              <Breakdown title="By locality" rows={r.by_locality} />
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
