'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Phone } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState } from '@/components/shared/states';
import { Section, DetailRow } from '@/components/shared/section';
import { StatusBadge } from '@/components/shared/status-badge';
import { ActionDialog } from '@/components/shared/action-dialog';
import { selectClass } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { dealStatusBadge, formatDate, formatDateTime, formatPrice, humanize, leadStatusBadge, listingStatusLabels, propertyTypeLabel } from '@/lib/format';
import type { Deal, Lead, ManagedProperty, OwnerNote } from '@/lib/types';

const NOTE_TYPES = ['availability', 'confirmed_price', 'viewing_availability', 'negotiation', 'owner_response', 'agreed_terms', 'general'];

export default function TeamPropertyPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi<{ data: ManagedProperty; owner_notes: OwnerNote[]; leads: Lead[]; deals: Deal[] }>(`/team/properties/${id}`);

  return (
    <DataState loading={loading} error={error} data={data} onRetry={reload}>
      {(d) => {
        const p = d.data;
        return (
          <>
            <Link href="/team/properties" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> All properties</Link>
            <PageHeader
              title={p.title}
              description={<span className="flex flex-wrap items-center gap-2">{p.reference_code} <StatusBadge {...listingStatusLabels(p.status)} /></span>}
              actions={
                <>
                  {p.is_public && <Button asChild variant="outline" className="gap-2"><Link href={`/property/${p.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /> Public page</Link></Button>}
                  {can('properties.moderate') && <Button asChild variant="outline"><Link href={`/admin/properties/${p.id}`}>Moderate</Link></Button>}
                </>
              }
            />
            <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
              <div className="space-y-6">
                {p.images && p.images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {p.images.map((img) => (
                      <div key={img.id} className="relative h-28 w-40 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <Image src={img.url} alt={img.alt ?? ''} fill sizes="160px" className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <Section
                  title="Owner coordination notes (internal)"
                  actions={
                    <ActionDialog trigger={<Button size="sm" variant="outline">Add note</Button>} title="Owner coordination note" confirmLabel="Save"
                      onConfirm={async (fd) => { await api.post(`/team/properties/${id}/owner-notes`, { type: fd.get('type'), body: fd.get('body') }); toast({ title: 'Note added' }); reload(); }}>
                      <select name="type" className={selectClass} aria-label="Note type">{NOTE_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</select>
                      <Textarea name="body" required placeholder="Owner availability, confirmed price, response, agreed terms…" />
                    </ActionDialog>
                  }
                >
                  {d.owner_notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet.</p> : (
                    <ul className="space-y-2">
                      {d.owner_notes.map((n) => (
                        <li key={n.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                          <p className="text-xs text-muted-foreground">{humanize(n.type)} · {n.user?.name} · {formatDateTime(n.created_at)}</p>
                          <p className="whitespace-pre-line">{n.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
                <Section title={`Leads (${d.leads.length})`}>
                  {d.leads.length === 0 ? <p className="text-sm text-muted-foreground">No visible leads for this property.</p> : (
                    <ul className="divide-y divide-border text-sm">
                      {d.leads.map((l) => (
                        <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                          <Link href={`/team/leads/${l.id}`} className="text-primary hover:underline">{l.name} <span className="text-xs text-muted-foreground">{l.reference_code}</span></Link>
                          <span className="text-xs text-muted-foreground">{l.assignee?.name ?? 'Unassigned'}</span>
                          <StatusBadge {...leadStatusBadge(l.status)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
                <Section title={`Deals (${d.deals.length})`}>
                  {d.deals.length === 0 ? <p className="text-sm text-muted-foreground">No deals.</p> : (
                    <ul className="divide-y divide-border text-sm">
                      {d.deals.map((deal) => (
                        <li key={deal.id} className="flex items-center justify-between py-2">
                          <Link href={`/team/deals/${deal.id}`} className="text-primary hover:underline">{deal.reference_code} · {deal.customer_name}</Link>
                          <StatusBadge {...dealStatusBadge(deal.status)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
              <div className="space-y-6">
                <Section title="Owner contact (private)">
                  <dl>
                    <DetailRow label="Contact">{p.coordination_contact?.name ?? '—'}</DetailRow>
                    <DetailRow label="Phone">{p.coordination_contact?.phone ? <a className="inline-flex items-center gap-1 text-primary" href={`tel:${p.coordination_contact.phone}`}><Phone className="h-3.5 w-3.5" />{p.coordination_contact.phone}</a> : '—'}</DetailRow>
                    <DetailRow label="Email">{p.coordination_contact?.email ?? '—'}</DetailRow>
                    <DetailRow label="Account">{p.owner?.name} {p.owner && !p.owner.is_active && '(inactive)'}</DetailRow>
                    <DetailRow label="Full address">{p.private_address ?? '—'}</DetailRow>
                    <DetailRow label="Pincode">{p.pincode ?? '—'}</DetailRow>
                  </dl>
                </Section>
                <Section title="Listing">
                  <dl>
                    <DetailRow label="Type">{propertyTypeLabel(p.property_type)} · {p.listing_purpose}</DetailRow>
                    <DetailRow label={p.listing_purpose === 'rent' ? 'Rent' : 'Asking'}>{formatPrice(p.price, p.listing_purpose)}{p.price_negotiable && ' (negotiable)'}</DetailRow>
                    {p.security_deposit && <DetailRow label="Deposit">{formatPrice(p.security_deposit)}</DetailRow>}
                    <DetailRow label="Locality">{p.locality?.name}</DetailRow>
                    <DetailRow label="Public location">{p.public_address}</DetailRow>
                    <DetailRow label="Area / BHK">{p.area_sqft} sq ft · {p.bedrooms ?? '—'} BHK</DetailRow>
                    <DetailRow label="Furnishing">{humanize(p.furnishing)}</DetailRow>
                    <DetailRow label="Published">{formatDate(p.published_at)}</DetailRow>
                    <DetailRow label="Expires">{formatDate(p.expires_at)}</DetailRow>
                  </dl>
                </Section>
              </div>
            </div>
          </>
        );
      }}
    </DataState>
  );
}
