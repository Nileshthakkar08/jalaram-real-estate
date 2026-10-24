'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ExternalLink, Star, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState } from '@/components/shared/states';
import { Section, DetailRow } from '@/components/shared/section';
import { StatusBadge } from '@/components/shared/status-badge';
import { ActionDialog } from '@/components/shared/action-dialog';
import { selectClass } from '@/components/shared/form-field';
import { PropertyForm } from '@/components/property/property-form';
import { ImageManager } from '@/components/property/image-manager';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatDate, formatDateTime, formatPrice, listingStatusLabels } from '@/lib/format';
import type { AuditLog, ManagedProperty } from '@/lib/types';

const MODERATOR_TRANSITIONS: Record<string, string[]> = {
  published: ['suspended', 'unavailable', 'closed', 'expired'],
  suspended: ['published', 'closed'],
  unavailable: ['published', 'closed'],
  expired: ['published', 'closed'],
  closed: ['published'],
};

export default function AdminPropertyPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload, setData } = useApi<{ data: ManagedProperty; history: AuditLog[] }>(`/admin/properties/${id}`);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    await fn();
    toast({ title: message });
    reload();
  };

  return (
    <DataState loading={loading} error={error} data={data} onRetry={reload}>
      {(d) => {
        const p = d.data;
        const transitions = MODERATOR_TRANSITIONS[p.status] ?? [];
        return (
          <>
            <Link href="/admin/properties" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> All listings</Link>
            <PageHeader
              title={p.title}
              description={<span className="flex flex-wrap items-center gap-2">{p.reference_code} <StatusBadge {...listingStatusLabels(p.status)} /> · Owner {p.owner?.name} ({p.owner?.email})</span>}
              actions={
                <>
                  {p.status === 'pending' && (
                    <>
                      <ActionDialog trigger={<Button className="gap-2"><CheckCircle2 className="h-4 w-4" /> Approve & publish</Button>} title="Approve listing"
                        description="The listing will appear on the website immediately." confirmLabel="Approve"
                        onConfirm={async (fd) => run(() => api.post(`/admin/properties/${id}/approve`, { note: fd.get('note') || null }), 'Listing published')}>
                        <Textarea name="note" placeholder="Internal note (optional)" />
                      </ActionDialog>
                      <ActionDialog trigger={<Button variant="outline" className="gap-2 text-destructive"><XCircle className="h-4 w-4" /> Reject</Button>} title="Reject listing"
                        description="The owner will see this reason and can fix the listing and resubmit." confirmLabel="Reject" destructive
                        onConfirm={async (fd) => run(() => api.post(`/admin/properties/${id}/reject`, { reason: fd.get('reason') }), 'Listing rejected')}>
                        <Textarea name="reason" required minLength={5} placeholder="What needs to change?" />
                      </ActionDialog>
                    </>
                  )}
                  {transitions.length > 0 && (
                    <ActionDialog trigger={<Button variant="outline">Change status</Button>} title="Change listing status"
                      description="Suspending requires a reason. Publishing again resets the expiry period." confirmLabel="Update"
                      onConfirm={async (fd) => run(() => api.post(`/admin/properties/${id}/status`, { status: fd.get('status'), reason: fd.get('reason') || null }), 'Status updated')}>
                      <select name="status" className={selectClass} aria-label="New status">
                        {transitions.map((s) => <option key={s} value={s}>{listingStatusLabels(s).label}</option>)}
                      </select>
                      <Textarea name="reason" placeholder="Reason" />
                    </ActionDialog>
                  )}
                  <Button variant="outline" className="gap-2" onClick={() => run(() => api.post(`/admin/properties/${id}/feature`, { featured: !p.is_featured }), p.is_featured ? 'Removed from featured' : 'Marked as featured')}>
                    <Star className={`h-4 w-4 ${p.is_featured ? 'fill-accent text-accent' : ''}`} /> {p.is_featured ? 'Unfeature' : 'Feature'}
                  </Button>
                  {p.is_public && <Button asChild variant="ghost" className="gap-2"><Link href={`/property/${p.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /> View</Link></Button>}
                </>
              }
            />
            {p.rejection_reason && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-900"><strong>Rejection reason:</strong> {p.rejection_reason}</p>}

            <Tabs defaultValue="review">
              <TabsList>
                <TabsTrigger value="review">Review</TabsTrigger>
                <TabsTrigger value="edit">Edit details</TabsTrigger>
                <TabsTrigger value="photos">Photos ({p.images?.length ?? 0})</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="review" className="mt-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Section title="Listing">
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{p.description}</p>
                    <dl className="mt-4">
                      <DetailRow label="Purpose / type">{p.listing_purpose} · {p.property_type}</DetailRow>
                      <DetailRow label="Price">{formatPrice(p.price, p.listing_purpose)}</DetailRow>
                      <DetailRow label="Locality">{p.locality?.name}</DetailRow>
                      <DetailRow label="Public location">{p.public_address}</DetailRow>
                      <DetailRow label="Area / BHK">{p.area_sqft} sq ft · {p.bedrooms ?? '—'}</DetailRow>
                      <DetailRow label="Amenities">{p.amenities?.map((a) => a.name).join(', ') || '—'}</DetailRow>
                    </dl>
                  </Section>
                  <Section title="Private & moderation">
                    <dl>
                      <DetailRow label="Private address">{p.private_address ?? '—'}</DetailRow>
                      <DetailRow label="Owner contact">{p.coordination_contact?.name} · {p.coordination_contact?.phone}</DetailRow>
                      <DetailRow label="Submitted">{formatDateTime(p.submitted_at)}</DetailRow>
                      <DetailRow label="Reviewed">{formatDateTime(p.reviewed_at)} {p.reviewer && `by ${p.reviewer.name}`}</DetailRow>
                      <DetailRow label="Published">{formatDate(p.published_at)}</DetailRow>
                      <DetailRow label="Expires">{formatDate(p.expires_at)}</DetailRow>
                      <DetailRow label="Leads / deals">{p.leads_count ?? 0} / {p.deals_count ?? 0}</DetailRow>
                    </dl>
                    {p.moderation_note && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{p.moderation_note}</p>}
                  </Section>
                </div>
              </TabsContent>
              <TabsContent value="edit" className="mt-6">
                <PropertyForm initial={p} staff submitLabel="Save changes" onSubmit={async (payload) => {
                  const res = await api.put<{ data: ManagedProperty }>(`/admin/properties/${id}`, payload);
                  setData({ ...d, data: res.data });
                  toast({ title: 'Listing updated' });
                }} />
              </TabsContent>
              <TabsContent value="photos" className="mt-6">
                <Section title="Photos">
                  <ImageManager basePath={`/admin/properties/${id}`} images={p.images ?? []} onChange={(images) => setData({ ...d, data: { ...p, images } })} />
                </Section>
              </TabsContent>
              <TabsContent value="history" className="mt-6">
                <Section title="History">
                  <ul className="space-y-2 text-sm">
                    {d.history.map((h) => (
                      <li key={h.id} className="border-b border-border pb-2 last:border-0">
                        <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)} · {h.user?.name ?? 'System'}</p>
                        <p><span className="font-medium">{h.action}</span>{h.reason && ` — ${h.reason}`}</p>
                      </li>
                    ))}
                  </ul>
                </Section>
              </TabsContent>
            </Tabs>
          </>
        );
      }}
    </DataState>
  );
}
