'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, Handshake, Mail, MessageCircle, Phone, UserCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState } from '@/components/shared/states';
import { Section, DetailRow } from '@/components/shared/section';
import { StatusBadge } from '@/components/shared/status-badge';
import { ActionDialog } from '@/components/shared/action-dialog';
import { Field, selectClass } from '@/components/shared/form-field';
import { SiteVisitActions } from '@/components/team/site-visit-actions';
import { useTeamMembers } from '@/components/team/use-team-members';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth-context';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  dealStatusBadge, formatDate, formatDateTime, formatMoney, formatPrice, humanize, leadStatusBadge, leadStatusLabel,
  toDateTimeLocal, visitStatusBadge,
} from '@/lib/format';
import type { Deal, FollowUp, Lead, LeadActivity, OwnerNote, SiteVisit } from '@/lib/types';

interface LeadDetail {
  data: Lead;
  activities: LeadActivity[];
  follow_ups: FollowUp[];
  site_visits: SiteVisit[];
  deals: Deal[];
  owner_contact: { name: string | null; phone: string | null; email: string | null; private_address: string | null } | null;
  owner_notes: OwnerNote[];
  other_leads: { id: number; reference_code: string; status: string; property: string | null; created_at: string }[];
  can: { work: boolean; assign_others: boolean; transitions: string[] };
}

const OUTCOMES = ['connected', 'no_answer', 'busy', 'switched_off', 'wrong_number', 'call_back_later', 'not_interested'];
const ACTIVITY_TYPES = ['call', 'whatsapp', 'email', 'sms', 'meeting', 'note', 'requirement', 'negotiation'];
const NOTE_TYPES = ['availability', 'confirmed_price', 'viewing_availability', 'negotiation', 'owner_response', 'agreed_terms', 'general'];

function inAnHour() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toDateTimeLocal(d);
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const members = useTeamMembers();
  const { data, loading, error, reload } = useApi<LeadDetail>(`/team/leads/${id}`);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    await fn();
    toast({ title: message });
    reload();
  };

  return (
    <DataState loading={loading} error={error} data={data} onRetry={reload}>
      {(d) => {
        const lead = d.data;
        const canWork = d.can.work;
        const isOpen = !['won', 'lost', 'cancelled'].includes(lead.status);
        const unassigned = !lead.assigned_to;

        return (
          <>
            <Link href="/team/leads" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> All leads</Link>
            <PageHeader
              title={lead.name}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  {lead.reference_code} <StatusBadge {...leadStatusBadge(lead.status)} />
                  <span>· {humanize(lead.interest)} · via {humanize(lead.source)} · {formatDateTime(lead.created_at)}</span>
                </span>
              }
              actions={
                <>
                  {unassigned && !d.can.assign_others && (
                    <Button className="gap-2" onClick={() => run(() => api.post(`/team/leads/${id}/assign`, { user_id: user?.id }), 'Lead claimed')}>
                      <UserCheck className="h-4 w-4" /> Claim lead
                    </Button>
                  )}
                  {d.can.assign_others && (
                    <ActionDialog
                      trigger={<Button variant={unassigned ? 'default' : 'outline'} className="gap-2"><UserCheck className="h-4 w-4" /> {unassigned ? 'Assign' : 'Reassign'}</Button>}
                      title="Assign lead"
                      confirmLabel="Assign"
                      onConfirm={async (fd) => run(() => api.post(`/team/leads/${id}/assign`, { user_id: Number(fd.get('user_id')) }), 'Lead assigned')}
                    >
                      <select name="user_id" className={selectClass} defaultValue={lead.assigned_to ?? user?.id} aria-label="Team member">
                        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </ActionDialog>
                  )}
                  {canWork && d.can.transitions.length > 0 && (
                    <ActionDialog
                      trigger={<Button variant="outline">Change status</Button>}
                      title="Change lead status"
                      description="A lead becomes Won only when its deal is closed. Lost and cancelled need a reason."
                      confirmLabel="Update status"
                      onConfirm={async (fd) => run(() => api.post(`/team/leads/${id}/status`, { status: fd.get('status'), reason: fd.get('reason') || null }), 'Status updated')}
                    >
                      <select name="status" className={selectClass} aria-label="New status">
                        {d.can.transitions.map((s) => <option key={s} value={s}>{leadStatusLabel(s)}</option>)}
                      </select>
                      <Textarea name="reason" placeholder="Reason / note" />
                    </ActionDialog>
                  )}
                </>
              }
            />

            {!canWork && (
              <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {unassigned ? 'Claim this lead to start working on it.' : `This lead is assigned to ${lead.assignee?.name}. You can view it but not update it.`}
              </p>
            )}

            <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
              <div className="space-y-6">
                {/* Log activity */}
                {canWork && (
                  <Section title="Log contact or note">
                    <form
                      className="space-y-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const fd = new FormData(form);
                        try {
                          await api.post(`/team/leads/${id}/activities`, { type: fd.get('type'), outcome: fd.get('outcome') || null, body: fd.get('body') || null });
                          form.reset();
                          toast({ title: 'Activity logged' });
                          reload();
                        } catch (err) {
                          toast({ title: 'Could not log activity', description: errorMessage(err), variant: 'destructive' });
                        }
                      }}
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select name="type" className={selectClass} defaultValue="call" aria-label="Activity type">
                          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                        </select>
                        <select name="outcome" className={selectClass} defaultValue="" aria-label="Outcome">
                          <option value="">Outcome (for calls/messages)</option>
                          {OUTCOMES.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
                        </select>
                      </div>
                      <Textarea name="body" placeholder="What happened? Requirement details, call notes, negotiation points…" rows={3} />
                      <div className="flex justify-end"><Button type="submit">Save</Button></div>
                    </form>
                  </Section>
                )}

                {/* Follow-ups */}
                <Section
                  title="Follow-ups"
                  actions={canWork && isOpen && (
                    <ActionDialog
                      trigger={<Button size="sm" variant="outline" className="gap-2"><CalendarPlus className="h-4 w-4" /> Schedule</Button>}
                      title="Schedule follow-up"
                      confirmLabel="Schedule"
                      onConfirm={async (fd) => run(() => api.post(`/team/leads/${id}/follow-ups`, {
                        due_at: new Date(String(fd.get('due_at'))).toISOString(), channel: fd.get('channel'), notes: fd.get('notes') || null,
                      }), 'Follow-up scheduled')}
                    >
                      <Field label="When" htmlFor="fu-due"><Input id="fu-due" name="due_at" type="datetime-local" required defaultValue={inAnHour()} /></Field>
                      <select name="channel" className={selectClass} defaultValue="call" aria-label="Channel">
                        {['call', 'whatsapp', 'email', 'meeting', 'other'].map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
                      </select>
                      <Textarea name="notes" placeholder="What to follow up on" />
                    </ActionDialog>
                  )}
                >
                  {d.follow_ups.length === 0 ? <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p> : (
                    <ul className="divide-y divide-border">
                      {d.follow_ups.map((f) => (
                        <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                          <div>
                            <p className={f.is_overdue ? 'font-medium text-red-700' : 'font-medium'}>
                              {formatDateTime(f.due_at)} · {humanize(f.channel)} {f.status !== 'pending' && <span className="text-muted-foreground">({f.status})</span>}
                            </p>
                            {f.notes && <p className="text-xs text-muted-foreground">{f.notes}</p>}
                            {f.outcome && <p className="text-xs">Outcome: {f.outcome}</p>}
                          </div>
                          {canWork && f.status === 'pending' && (
                            <div className="flex gap-1">
                              <ActionDialog trigger={<Button size="sm" variant="outline">Done</Button>} title="Complete follow-up" confirmLabel="Mark done"
                                onConfirm={async (fd) => run(() => api.patch(`/team/follow-ups/${f.id}`, { action: 'complete', outcome: fd.get('outcome') || null }), 'Follow-up completed')}>
                                <Textarea name="outcome" placeholder="Outcome" />
                              </ActionDialog>
                              <ActionDialog trigger={<Button size="sm" variant="ghost">Reschedule</Button>} title="Reschedule follow-up" confirmLabel="Save"
                                onConfirm={async (fd) => run(() => api.patch(`/team/follow-ups/${f.id}`, { action: 'reschedule', due_at: new Date(String(fd.get('due_at'))).toISOString() }), 'Follow-up rescheduled')}>
                                <Input name="due_at" type="datetime-local" required defaultValue={inAnHour()} aria-label="New time" />
                              </ActionDialog>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => run(() => api.patch(`/team/follow-ups/${f.id}`, { action: 'cancel' }), 'Follow-up cancelled')}>Cancel</Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {/* Site visits */}
                <Section
                  title="Site visits"
                  actions={canWork && isOpen && (
                    <ActionDialog
                      trigger={<Button size="sm" variant="outline" className="gap-2"><CalendarPlus className="h-4 w-4" /> New visit</Button>}
                      title="Schedule a site visit"
                      confirmLabel="Schedule"
                      onConfirm={async (fd) => run(() => api.post('/team/site-visits', {
                        lead_id: lead.id, property_id: Number(fd.get('property_id')),
                        scheduled_at: new Date(String(fd.get('scheduled_at'))).toISOString(),
                        owner_confirmed: fd.get('owner_confirmed') === 'on', notes: fd.get('notes') || null,
                      }), 'Site visit scheduled')}
                    >
                      <Field label="Property ID" htmlFor="sv-prop" hint="Defaults to the enquired property. Find others under Properties.">
                        <Input id="sv-prop" name="property_id" type="number" required defaultValue={lead.property?.id ?? ''} />
                      </Field>
                      <Field label="Date and time" htmlFor="sv-when"><Input id="sv-when" name="scheduled_at" type="datetime-local" required defaultValue={inAnHour()} /></Field>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="owner_confirmed" /> Owner has confirmed</label>
                      <Textarea name="notes" placeholder="Notes" />
                    </ActionDialog>
                  )}
                >
                  {d.site_visits.length === 0 ? <p className="text-sm text-muted-foreground">No visits yet.</p> : (
                    <ul className="space-y-3">
                      {d.site_visits.map((v) => (
                        <li key={v.id} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge {...visitStatusBadge(v.status)} />
                            <span className="font-medium">{v.scheduled_at ? formatDateTime(v.scheduled_at) : `Requested ${formatDate(v.requested_date)} ${v.requested_slot ?? ''}`}</span>
                            {v.owner_confirmed && <span className="text-xs text-green-700">Owner confirmed</span>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{v.property?.title} · with {v.assignee?.name ?? '—'}</p>
                          {v.customer_feedback && <p className="mt-1 text-xs">Feedback: {v.customer_feedback}</p>}
                          {canWork && <div className="mt-2"><SiteVisitActions visit={v} onChanged={reload} /></div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {/* Deals */}
                <Section
                  title="Deals"
                  actions={canWork && isOpen && lead.property && (
                    <ActionDialog
                      trigger={<Button size="sm" className="gap-2"><Handshake className="h-4 w-4" /> Open deal</Button>}
                      title="Open a deal"
                      description={`Negotiation for ${lead.property.title}. Brokerage is estimated from the active rule; you agree the actual amounts on the deal page.`}
                      confirmLabel="Open deal"
                      onConfirm={async (fd) => {
                        const res = await api.post<{ data: Deal }>('/team/deals', {
                          lead_id: lead.id, property_id: lead.property!.id,
                          final_price: fd.get('final_price') || null, negotiation_notes: fd.get('negotiation_notes') || null,
                        });
                        toast({ title: `Deal ${res.data.reference_code} opened` });
                        router.push(`/team/deals/${res.data.id}`);
                      }}
                    >
                      <Field label={lead.property.listing_purpose === 'rent' ? 'Agreed monthly rent (if known)' : 'Agreed sale price (if known)'} htmlFor="deal-price"
                        hint={`Asking: ${formatPrice(lead.property.price, lead.property.listing_purpose)}`}>
                        <Input id="deal-price" name="final_price" type="number" min={1} />
                      </Field>
                      <Textarea name="negotiation_notes" placeholder="Negotiation notes" />
                    </ActionDialog>
                  )}
                >
                  {d.deals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{lead.property ? 'No deal yet.' : 'Link this lead to a property (via a site visit) before opening a deal.'}</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {d.deals.map((deal) => (
                        <li key={deal.id} className="flex items-center justify-between py-2 text-sm">
                          <Link href={`/team/deals/${deal.id}`} className="font-medium text-primary hover:underline">{deal.reference_code}</Link>
                          <span className="text-muted-foreground">Est. {formatMoney(deal.estimated_brokerage)}</span>
                          <StatusBadge {...dealStatusBadge(deal.status)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {/* Timeline */}
                <Section title="Activity timeline">
                  <ol className="relative space-y-4 border-l border-border pl-5">
                    {d.activities.map((a) => (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(a.created_at)} · {a.user?.name ?? 'System'} · <span className="font-medium capitalize text-foreground">{humanize(a.type)}</span>
                          {a.outcome && <> · {humanize(a.outcome)}</>}
                        </p>
                        {a.body && <p className="mt-0.5 whitespace-pre-line text-sm">{a.body}</p>}
                      </li>
                    ))}
                  </ol>
                </Section>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                <Section title="Customer">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" className="gap-1.5"><a href={`tel:${lead.phone}`}><Phone className="h-4 w-4" /> Call</a></Button>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <a href={`https://wa.me/${lead.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
                    </Button>
                    {lead.email && <Button asChild size="sm" variant="outline" className="gap-1.5"><a href={`mailto:${lead.email}`}><Mail className="h-4 w-4" /> Email</a></Button>}
                  </div>
                  <dl>
                    <DetailRow label="Phone">{lead.phone}</DetailRow>
                    <DetailRow label="Email">{lead.email ?? '—'}</DetailRow>
                    <DetailRow label="Assigned to">{lead.assignee?.name ?? 'Unassigned'}</DetailRow>
                    <DetailRow label="Contact attempts">{lead.contact_attempts}</DetailRow>
                    <DetailRow label="Last contacted">{formatDateTime(lead.last_contacted_at)}</DetailRow>
                    <DetailRow label="Budget">{lead.budget_min || lead.budget_max ? `${lead.budget_min ? formatPrice(lead.budget_min) : '—'} – ${lead.budget_max ? formatPrice(lead.budget_max) : '—'}` : '—'}</DetailRow>
                    <DetailRow label="Preferred visit">{lead.preferred_visit_date ? `${formatDate(lead.preferred_visit_date)} ${lead.preferred_visit_slot ?? ''}` : '—'}</DetailRow>
                    <DetailRow label="Marketing consent">{lead.consent_marketing ? 'Yes' : 'No'}</DetailRow>
                    <DetailRow label="Source page">{lead.source_page ?? '—'}</DetailRow>
                    {lead.utm_campaign && <DetailRow label="Campaign">{lead.utm_source} / {lead.utm_campaign}</DetailRow>}
                    {lead.closed_reason && <DetailRow label="Closed reason">{lead.closed_reason}</DetailRow>}
                  </dl>
                  {lead.message && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">&ldquo;{lead.message}&rdquo;</p>}
                  {lead.requirements && (
                    <div className="mt-3">
                      <p className="text-xs font-medium uppercase text-muted-foreground">Requirements</p>
                      <p className="mt-1 whitespace-pre-line text-sm">{lead.requirements}</p>
                    </div>
                  )}
                </Section>

                {lead.property && (
                  <Section title="Property & owner">
                    <Link href={`/team/properties/${lead.property.id}`} className="font-medium text-primary hover:underline">{lead.property.title}</Link>
                    <p className="text-xs text-muted-foreground">{lead.property.reference_code} · {formatPrice(lead.property.price, lead.property.listing_purpose)} · {humanize(lead.property.status)}</p>
                    {d.owner_contact && (
                      <dl className="mt-3">
                        <DetailRow label="Owner">{d.owner_contact.name ?? '—'}</DetailRow>
                        <DetailRow label="Phone">{d.owner_contact.phone ? <a href={`tel:${d.owner_contact.phone}`} className="text-primary">{d.owner_contact.phone}</a> : '—'}</DetailRow>
                        <DetailRow label="Email">{d.owner_contact.email ?? '—'}</DetailRow>
                        <DetailRow label="Address">{d.owner_contact.private_address ?? '—'}</DetailRow>
                      </dl>
                    )}
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium uppercase text-muted-foreground">Owner coordination (internal)</p>
                        {canWork && (
                          <ActionDialog trigger={<Button size="sm" variant="ghost">Add note</Button>} title="Owner coordination note" confirmLabel="Save"
                            onConfirm={async (fd) => run(() => api.post(`/team/properties/${lead.property!.id}/owner-notes`, { type: fd.get('type'), body: fd.get('body'), lead_id: lead.id }), 'Note added')}>
                            <select name="type" className={selectClass} aria-label="Note type">
                              {NOTE_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                            </select>
                            <Textarea name="body" required placeholder="e.g. Owner available Saturday after 4pm; confirmed rent ₹12,000" />
                          </ActionDialog>
                        )}
                      </div>
                      {d.owner_notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet.</p> : (
                        <ul className="space-y-2">
                          {d.owner_notes.map((n) => (
                            <li key={n.id} className="rounded-lg bg-muted/60 p-2 text-sm">
                              <p className="text-xs text-muted-foreground">{humanize(n.type)} · {n.user?.name} · {formatDateTime(n.created_at)}</p>
                              <p className="whitespace-pre-line">{n.body}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Section>
                )}

                {d.other_leads.length > 0 && (
                  <Section title="Other enquiries from this customer">
                    <ul className="space-y-1.5 text-sm">
                      {d.other_leads.map((o) => (
                        <li key={o.id} className="flex justify-between gap-2">
                          <Link href={`/team/leads/${o.id}`} className="text-primary hover:underline">{o.reference_code}</Link>
                          <span className="truncate text-muted-foreground">{o.property ?? 'General'}</span>
                          <span className="text-xs">{leadStatusLabel(o.status)}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
            </div>
          </>
        );
      }}
    </DataState>
  );
}
