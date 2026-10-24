'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { DataState, EmptyState, LoadingState } from '@/components/shared/states';
import { Pager } from '@/components/shared/pager';
import { ActionDialog } from '@/components/shared/action-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/hooks/use-api';
import { api, qs } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatDateTime, humanize, leadStatusLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FollowUp, Paginated } from '@/lib/types';

const TABS = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'done', label: 'Completed' },
];

function FollowUps() {
  const params = useSearchParams();
  const router = useRouter();
  const when = params.get('when') ?? 'today';
  const page = params.get('page') ?? '';
  const { data, loading, error, reload } = useApi<Paginated<FollowUp>>(`/team/follow-ups${qs({ when, page })}`);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.value} role="tab" aria-selected={when === t.value} onClick={() => router.push(`/team/follow-ups?when=${t.value}`)}
            className={cn('rounded-full border px-4 py-1.5 text-sm', when === t.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
            {t.label}
          </button>
        ))}
      </div>
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {(d) => d.data.length === 0 ? <EmptyState title="Nothing here" description="No follow-ups in this view." /> : (
          <div className="space-y-2">
            {d.data.map((f) => (
              <div key={f.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={cn('font-medium', f.is_overdue && 'text-red-700')}>{formatDateTime(f.due_at)} · {humanize(f.channel)}</p>
                  <p className="text-sm">
                    <Link href={`/team/leads/${f.lead_id}`} className="text-primary hover:underline">{f.lead?.name}</Link>
                    <span className="text-muted-foreground"> · {f.lead?.phone} · {f.lead ? leadStatusLabel(f.lead.status) : ''} · {f.assignee?.name}</span>
                  </p>
                  {f.notes && <p className="text-xs text-muted-foreground">{f.notes}</p>}
                  {f.outcome && <p className="text-xs">Outcome: {f.outcome}</p>}
                </div>
                {f.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline"><a href={`tel:${f.lead?.phone}`}>Call</a></Button>
                    <ActionDialog trigger={<Button size="sm">Mark done</Button>} title="Complete follow-up" confirmLabel="Done"
                      onConfirm={async (fd) => { await api.patch(`/team/follow-ups/${f.id}`, { action: 'complete', outcome: fd.get('outcome') || null }); toast({ title: 'Follow-up completed' }); reload(); }}>
                      <Textarea name="outcome" placeholder="Outcome" />
                    </ActionDialog>
                  </div>
                )}
              </div>
            ))}
            <Pager page={d.meta.current_page} lastPage={d.meta.last_page} onChange={(p) => router.push(`/team/follow-ups${qs({ when, page: p })}`)} />
          </div>
        )}
      </DataState>
    </>
  );
}

export default function FollowUpsPage() {
  return (
    <>
      <PageHeader title="Follow-ups" description="Scheduled calls and messages. Schedule new ones from a lead." />
      <Suspense fallback={<LoadingState />}><FollowUps /></Suspense>
    </>
  );
}
