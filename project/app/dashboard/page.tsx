'use client';

import Link from 'next/link';
import { Building2, CheckCircle2, Clock, FileEdit, Headphones, PlusCircle, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { DataState, EmptyState } from '@/components/shared/states';
import { Section } from '@/components/shared/section';
import { OwnerPropertyRow } from '@/components/property/owner-property-row';
import { Button } from '@/components/ui/button';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth-context';
import type { ManagedProperty } from '@/lib/types';

interface OwnerDashboard {
  counts: Record<string, number>;
  total: number;
  recent: ManagedProperty[];
}

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi<{ data: OwnerDashboard }>('/owner/dashboard');

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0] ?? ''}`}
        description="Manage your listings and track their review status."
        actions={<Button asChild className="gap-2"><Link href="/dashboard/properties/new"><PlusCircle className="h-4 w-4" /> Add listing</Link></Button>}
      />
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {({ data: d }) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatCard label="All listings" value={d.total} icon={Building2} href="/dashboard/properties" />
              <StatCard label="Drafts" value={d.counts.draft ?? 0} icon={FileEdit} href="/dashboard/properties?status=draft" />
              <StatCard label="Pending review" value={d.counts.pending ?? 0} icon={Clock} tone="warning" href="/dashboard/properties?status=pending" />
              <StatCard label="Published" value={d.counts.published ?? 0} icon={CheckCircle2} tone="success" href="/dashboard/properties?status=published" />
              <StatCard label="Needs changes" value={d.counts.rejected ?? 0} icon={XCircle} tone="danger" href="/dashboard/properties?status=rejected" />
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
              <Headphones className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <p className="text-muted-foreground">
                <strong className="text-foreground">Enquiries are managed by the Jalaram team.</strong> Buyers and tenants contact us, not you
                directly. We screen them, check availability with you and arrange site visits at a time that suits you.
              </p>
            </div>

            <Section title="Recently updated">
              {d.recent.length === 0 ? (
                <EmptyState
                  title="No listings yet"
                  description="Create your first listing. You can save it as a draft and submit it for review when it's ready."
                  action={<Button asChild><Link href="/dashboard/properties/new">Create a listing</Link></Button>}
                />
              ) : (
                <ul className="divide-y divide-border">
                  {d.recent.map((p) => <OwnerPropertyRow key={p.id} property={p} />)}
                </ul>
              )}
            </Section>
          </div>
        )}
      </DataState>
    </>
  );
}
