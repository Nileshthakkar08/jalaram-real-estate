'use client';

import Link from 'next/link';
import { AlarmClock, Bell, Building2, CheckCircle2, Clock, Handshake, IndianRupee, Inbox, UserX, Users, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Section } from '@/components/shared/section';
import { DataState } from '@/components/shared/states';
import { useApi } from '@/hooks/use-api';
import { formatMoney, humanize, listingStatusLabels } from '@/lib/format';

interface AdminDashboard {
  properties: Record<string, number>;
  users: Record<string, number>;
  leads: { open: number; unassigned: number; this_month: number; won_this_month: number };
  deals: { open: number; closed_won_this_month: number };
  brokerage: { potential: string; agreed_this_month: string; collected_this_month: string; outstanding: string };
  pending_review: number;
  push_subscribers?: number;
}

export default function AdminDashboardPage() {
  const { data, loading, error, reload } = useApi<{ data: AdminDashboard }>('/admin/dashboard');

  return (
    <>
      <PageHeader title="Administration" description="Platform overview." />
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {({ data: d }) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Listings awaiting review" value={d.pending_review} icon={Clock} tone={d.pending_review ? 'warning' : 'default'} href="/admin/properties?status=pending" />
              <StatCard label="Open leads" value={d.leads.open} icon={Inbox} href="/admin/leads?status=open" />
              <StatCard label="Unassigned leads" value={d.leads.unassigned} icon={UserX} tone={d.leads.unassigned ? 'warning' : 'default'} href="/admin/leads?assigned=unassigned&status=open" />
              <StatCard label="Leads this month" value={d.leads.this_month} icon={Inbox} />
              <StatCard label="Open deals" value={d.deals.open} icon={Handshake} href="/admin/deals?status=open" />
              <StatCard label="Deals won this month" value={d.deals.closed_won_this_month} icon={CheckCircle2} tone="success" />
              <StatCard label="Collected this month" value={formatMoney(d.brokerage.collected_this_month)} icon={Wallet} tone="success" href="/admin/reports" />
              <StatCard label="Outstanding brokerage" value={formatMoney(d.brokerage.outstanding)} icon={AlarmClock} tone="warning" href="/admin/deals?payment=outstanding" />
              <StatCard label="Agreed this month" value={formatMoney(d.brokerage.agreed_this_month)} icon={IndianRupee} />
              <StatCard label="Pipeline estimate" value={formatMoney(d.brokerage.potential)} icon={IndianRupee} hint="Open deals — not revenue" />
              <StatCard label="Notification subscribers" value={d.push_subscribers ?? 0} icon={Bell} hint="Get a browser alert for each new listing" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Section title={<span className="flex items-center gap-2"><Building2 className="h-5 w-5 text-accent" /> Listings by status</span>}>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(d.properties).map(([s, n]) => (
                    <Link key={s} href={`/admin/properties?status=${s}`} className="rounded-lg border border-border px-3 py-2 text-sm hover:border-accent">
                      {listingStatusLabels(s).label} <span className="ml-1 font-semibold">{n}</span>
                    </Link>
                  ))}
                </div>
              </Section>
              <Section title={<span className="flex items-center gap-2"><Users className="h-5 w-5 text-accent" /> Users by role</span>}>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(d.users).map(([r, n]) => (
                    <Link key={r} href={`/admin/users?role=${r}`} className="rounded-lg border border-border px-3 py-2 text-sm hover:border-accent">
                      {humanize(r)} <span className="ml-1 font-semibold">{n}</span>
                    </Link>
                  ))}
                </div>
              </Section>
            </div>
          </div>
        )}
      </DataState>
    </>
  );
}
