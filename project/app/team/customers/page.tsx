'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState, EmptyState, LoadingState } from '@/components/shared/states';
import { Pager } from '@/components/shared/pager';
import { Input } from '@/components/ui/input';
import { useApi } from '@/hooks/use-api';
import { qs } from '@/lib/api';
import { leadStatusLabel, timeAgo } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface Customer {
  phone_normalized: string; name: string; phone: string; email: string | null; enquiries: number; open_leads: number;
  won_leads: number; last_enquiry_at: string; latest_lead_id: number; latest_status: string; assignee: { id: number; name: string } | null;
}

function Customers() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get('q') ?? '';
  const page = params.get('page') ?? '';
  const { data, loading, error, reload } = useApi<Paginated<Customer>>(`/team/customers${qs({ q, page })}`);

  return (
    <>
      <form className="relative mb-4 max-w-md" onSubmit={(e) => { e.preventDefault(); router.push(`/team/customers${qs({ q: String(new FormData(e.currentTarget).get('q') ?? '') })}`); }}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Name, phone or email" className="pl-9" aria-label="Search customers" />
      </form>
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {(d) => d.data.length === 0 ? <EmptyState title="No customers found" /> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Enquiries</th><th className="px-4 py-3">Open / won</th><th className="px-4 py-3">Latest</th><th className="px-4 py-3">Last enquiry</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.data.map((c) => (
                    <tr key={c.phone_normalized}>
                      <td className="px-4 py-3"><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.phone}{c.email && ` · ${c.email}`}</p></td>
                      <td className="px-4 py-3">{c.enquiries}</td>
                      <td className="px-4 py-3">{c.open_leads} / {c.won_leads}</td>
                      <td className="px-4 py-3"><Link href={`/team/leads/${c.latest_lead_id}`} className="text-primary hover:underline">{leadStatusLabel(c.latest_status)}</Link><p className="text-xs text-muted-foreground">{c.assignee?.name ?? 'Unassigned'}</p></td>
                      <td className="px-4 py-3 text-muted-foreground">{timeAgo(c.last_enquiry_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager className="border-t border-border py-3" page={d.meta.current_page} lastPage={d.meta.last_page} onChange={(p) => router.push(`/team/customers${qs({ q, page: p })}`)} />
          </div>
        )}
      </DataState>
    </>
  );
}

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" description="People who have enquired, grouped by phone number." />
      <Suspense fallback={<LoadingState />}><Customers /></Suspense>
    </>
  );
}
