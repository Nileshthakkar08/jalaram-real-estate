'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ExternalLink, Eye, EyeOff, Pencil, Send, Trash2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState } from '@/components/shared/states';
import { Section, DetailRow } from '@/components/shared/section';
import { StatusBadge } from '@/components/shared/status-badge';
import { ActionDialog } from '@/components/shared/action-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/hooks/use-api';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatDate, formatPrice, humanize, listingStatusLabels, propertyTypeLabel } from '@/lib/format';
import type { ManagedProperty } from '@/lib/types';

const STATUS_HELP: Record<string, string> = {
  draft: 'Only you can see this draft. Add photos and submit it for review when ready.',
  pending: 'Our team is reviewing your listing. It will appear on the website once approved.',
  published: 'Your listing is live. Enquiries come to the Jalaram team, who will contact you to arrange visits.',
  rejected: 'Our team asked for changes. Update the listing and submit it again.',
  unavailable: 'You marked this listing unavailable. It is hidden from the website.',
  expired: 'This listing has passed its publication period. Contact Jalaram to renew it.',
  closed: 'This listing is closed.',
  suspended: 'This listing has been suspended by Jalaram. Contact us for details.',
};

export default function OwnerPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, reload, setData } = useApi<{ data: ManagedProperty }>(`/owner/properties/${id}`);

  const act = async (fn: () => Promise<{ data: ManagedProperty }>, message: string) => {
    try {
      const res = await fn();
      setData({ data: res.data });
      toast({ title: message });
    } catch (err) {
      toast({ title: 'Action failed', description: errorMessage(err), variant: 'destructive' });
    }
  };

  return (
    <DataState loading={loading} error={error} data={data} onRetry={reload}>
      {({ data: p }) => {
        const badge = listingStatusLabels(p.status);
        return (
          <>
            <PageHeader
              title={p.title}
              description={<span className="flex flex-wrap items-center gap-2">{p.reference_code} <StatusBadge {...badge} /></span>}
              actions={
                <>
                  {!['closed', 'suspended'].includes(p.status) && (
                    <Button asChild variant="outline" className="gap-2"><Link href={`/dashboard/properties/${id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link></Button>
                  )}
                  {['draft', 'rejected'].includes(p.status) && (
                    <Button className="gap-2" onClick={() => act(() => api.post(`/owner/properties/${id}/submit`), 'Submitted for review')}>
                      <Send className="h-4 w-4" /> Submit for review
                    </Button>
                  )}
                  {p.status === 'published' && (
                    <Button variant="outline" className="gap-2" onClick={() => act(() => api.post(`/owner/properties/${id}/availability`, { available: false }), 'Marked unavailable')}>
                      <EyeOff className="h-4 w-4" /> Mark unavailable
                    </Button>
                  )}
                  {p.status === 'unavailable' && (
                    <Button variant="outline" className="gap-2" onClick={() => act(() => api.post(`/owner/properties/${id}/availability`, { available: true }), 'Listing is available again')}>
                      <Eye className="h-4 w-4" /> Mark available
                    </Button>
                  )}
                  {['pending', 'published', 'unavailable', 'expired'].includes(p.status) && (
                    <ActionDialog
                      trigger={<Button variant="outline" className="gap-2 text-destructive"><XCircle className="h-4 w-4" /> Withdraw</Button>}
                      title="Withdraw this listing?"
                      description="The listing will be closed and removed from the website. This cannot be undone from your portal."
                      confirmLabel="Withdraw listing"
                      destructive
                      onConfirm={async (fd) => {
                        const res = await api.post<{ data: ManagedProperty }>(`/owner/properties/${id}/close`, { reason: fd.get('reason') || null });
                        setData({ data: res.data });
                        toast({ title: 'Listing withdrawn' });
                      }}
                    >
                      <Textarea name="reason" placeholder="Reason (optional), e.g. sold privately" />
                    </ActionDialog>
                  )}
                  {['draft', 'rejected'].includes(p.status) && (
                    <ActionDialog
                      trigger={<Button variant="ghost" className="gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete</Button>}
                      title="Delete this listing?"
                      confirmLabel="Delete"
                      destructive
                      onConfirm={async () => {
                        await api.delete(`/owner/properties/${id}`);
                        toast({ title: 'Listing deleted' });
                        router.push('/dashboard/properties');
                      }}
                    />
                  )}
                </>
              }
            />

            <div className="mb-6 rounded-xl border border-border bg-card p-4 text-sm">
              <p className="text-muted-foreground">{STATUS_HELP[p.status]}</p>
              {p.status === 'rejected' && p.rejection_reason && (
                <p className="mt-2 rounded-lg bg-red-50 p-3 text-red-900"><strong>Reason:</strong> {p.rejection_reason}</p>
              )}
              {p.is_public && (
                <Link href={`/property/${p.slug}`} target="_blank" className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  View on website <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Section title={`Photos (${p.images?.length ?? 0})`}>
                {p.images && p.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {p.images.map((img, i) => (
                      <div key={img.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                        <Image src={img.url} alt={img.alt || `Photo ${i + 1}`} fill sizes="200px" className="object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No photos yet. <Link className="text-primary underline" href={`/dashboard/properties/${id}/edit?step=photos`}>Add photos</Link></p>
                )}
                <h3 className="mt-6 font-serif text-base font-semibold">Description</h3>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{p.description || '—'}</p>
              </Section>
              <Section title="Details">
                <dl>
                  <DetailRow label="Listing for">{p.listing_purpose === 'sale' ? 'Sale' : 'Rent'}</DetailRow>
                  <DetailRow label="Type">{propertyTypeLabel(p.property_type)}</DetailRow>
                  <DetailRow label={p.listing_purpose === 'rent' ? 'Monthly rent' : 'Asking price'}>{formatPrice(p.price, p.listing_purpose)}</DetailRow>
                  {p.security_deposit && <DetailRow label="Deposit">{formatPrice(p.security_deposit)}</DetailRow>}
                  <DetailRow label="Locality">{p.locality?.name}</DetailRow>
                  <DetailRow label="Public location">{p.public_address}</DetailRow>
                  <DetailRow label="Private address">{p.private_address || '—'}</DetailRow>
                  <DetailRow label="Area">{p.area_sqft} sq ft</DetailRow>
                  <DetailRow label="Bedrooms">{p.bedrooms ?? '—'}</DetailRow>
                  <DetailRow label="Furnishing">{humanize(p.furnishing)}</DetailRow>
                  <DetailRow label="Amenities">{p.amenities?.map((a) => a.name).join(', ') || '—'}</DetailRow>
                  <DetailRow label="Created">{formatDate(p.created_at)}</DetailRow>
                  <DetailRow label="Submitted">{formatDate(p.submitted_at)}</DetailRow>
                  <DetailRow label="Published">{formatDate(p.published_at)}</DetailRow>
                  <DetailRow label="Expires">{formatDate(p.expires_at)}</DetailRow>
                </dl>
              </Section>
            </div>
          </>
        );
      }}
    </DataState>
  );
}
