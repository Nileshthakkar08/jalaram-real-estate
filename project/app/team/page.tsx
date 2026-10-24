'use client';

import { useState } from 'react';
import {
  AlarmClock, CalendarCheck, CalendarClock, CheckCircle2, Handshake, IndianRupee, Inbox, UserCheck, UserX, Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Section } from '@/components/shared/section';
import { DataState } from '@/components/shared/states';
import { NewLeadDialog } from '@/components/team/new-lead-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/hooks/use-api';
import { qs } from '@/lib/api';
import { formatMoney, leadStatusLabel, todayISO } from '@/lib/format';

interface TeamDashboard {
  period: { from: string; to: string };
  leads: { new_in_period: number; new_status: number; unassigned: number; assigned_to_me: number; won_in_period: number; by_status: Record<string, number> };
  follow_ups: { due_today: number; overdue: number };
  site_visits: { requested: number; scheduled_upcoming: number };
  deals: { in_negotiation: number; closed_this_month: number };
  brokerage: { scope: 'all' | 'own_deals'; expected: string; agreed_this_month: string; collected_this_month: string; outstanding: string };
}

export default function TeamDashboardPage() {
  const [from, setFrom] = useState(todayISO(-29));
  const [to, setTo] = useState(todayISO());
  const { data, loading, error, reload } = useApi<{ data: TeamDashboard }>(`/team/dashboard${qs({ from, to })}`);

  return (
    <>
      <PageHeader title="Team dashboard" description="Every enquiry from the website lands here first." actions={<NewLeadDialog />} />
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label htmlFor="d-from">Enquiries from</Label><Input id="d-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="d-to">to</Label><Input id="d-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {({ data: d }) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              <StatCard label="New enquiries (period)" value={d.leads.new_in_period} icon={Inbox} href={`/team/leads?from=${from}&to=${to}`} />
              <StatCard label="Unassigned leads" value={d.leads.unassigned} icon={UserX} tone={d.leads.unassigned ? 'warning' : 'default'} href="/team/leads?assigned=unassigned&status=open" />
              <StatCard label="Assigned to me" value={d.leads.assigned_to_me} icon={UserCheck} href="/team/leads?assigned=me&status=open" />
              <StatCard label="Follow-ups due today" value={d.follow_ups.due_today} icon={CalendarClock} href="/team/follow-ups?when=today" />
              <StatCard label="Overdue follow-ups" value={d.follow_ups.overdue} icon={AlarmClock} tone={d.follow_ups.overdue ? 'danger' : 'default'} href="/team/follow-ups?when=overdue" />
              <StatCard label="Visit requests" value={d.site_visits.requested} icon={CalendarCheck} tone={d.site_visits.requested ? 'warning' : 'default'} href="/team/site-visits?status=requested" />
              <StatCard label="Visits scheduled" value={d.site_visits.scheduled_upcoming} icon={CalendarCheck} href="/team/site-visits?status=scheduled" />
              <StatCard label="Deals in negotiation" value={d.deals.in_negotiation} icon={Handshake} href="/team/deals?status=open" />
              <StatCard label="Deals closed this month" value={d.deals.closed_this_month} icon={CheckCircle2} tone="success" href="/team/deals?status=closed_won" />
            </div>

            <Section title={`Brokerage${d.brokerage.scope === 'own_deals' ? ' — your deals' : ''}`}>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Expected (open deals)" value={formatMoney(d.brokerage.expected)} icon={IndianRupee} hint="Rule estimates, not revenue" />
                <StatCard label="Agreed this month" value={formatMoney(d.brokerage.agreed_this_month)} icon={Handshake} />
                <StatCard label="Collected this month" value={formatMoney(d.brokerage.collected_this_month)} icon={Wallet} tone="success" />
                <StatCard label="Outstanding" value={formatMoney(d.brokerage.outstanding)} icon={AlarmClock} tone="warning" href="/team/deals?payment=outstanding" />
              </div>
            </Section>

            <Section title="Pipeline (visible leads)">
              <div className="flex flex-wrap gap-2">
                {Object.entries(d.leads.by_status).map(([status, count]) => (
                  <a key={status} href={`/team/leads?status=${status}`} className="rounded-lg border border-border px-3 py-2 text-sm hover:border-accent">
                    <span className="text-muted-foreground">{leadStatusLabel(status)}</span> <span className="ml-1 font-semibold">{count}</span>
                  </a>
                ))}
              </div>
            </Section>
          </div>
        )}
      </DataState>
    </>
  );
}
