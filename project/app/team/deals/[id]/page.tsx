'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Calculator, Download, FileUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState } from '@/components/shared/states';
import { Section, DetailRow } from '@/components/shared/section';
import { StatusBadge } from '@/components/shared/status-badge';
import { StatCard } from '@/components/shared/stat-card';
import { ActionDialog } from '@/components/shared/action-dialog';
import { Field, selectClass } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/hooks/use-api';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  agreementStatusBadge, dealStatusBadge, formatDate, formatDateTime, formatMoney, formatPrice, humanize, todayISO,
} from '@/lib/format';
import type { AuditLog, BrokerageAgreement, Deal } from '@/lib/types';

interface DealDetail {
  data: Deal;
  audit: AuditLog[];
  can: { manage_finance: boolean; transitions: string[] };
  options: { parties: string[]; payment_methods: string[] };
}

const DOC_TYPES = ['agreement', 'token_receipt', 'invoice', 'receipt', 'id_proof', 'other'];

function moneyOrNull(v: FormDataEntryValue | null) {
  return v === null || v === '' ? null : String(v);
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApi<DealDetail>(`/team/deals/${id}`);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    await fn();
    toast({ title: message });
    reload();
  };

  return (
    <DataState loading={loading} error={error} data={data} onRetry={reload}>
      {(d) => {
        const deal = d.data;
        const open = ['negotiation', 'agreement_pending'].includes(deal.status);
        const lost = ['closed_lost', 'cancelled'].includes(deal.status);
        const rent = deal.transaction_type === 'rent';
        const agreements = deal.agreements ?? [];
        const usedParties = agreements.filter((a) => a.status !== 'cancelled').map((a) => a.party);
        const freeParties = d.options.parties.filter((p) => !usedParties.includes(p as never));

        return (
          <>
            <Link href="/team/deals" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> All deals</Link>
            <PageHeader
              title={`Deal ${deal.reference_code}`}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge {...dealStatusBadge(deal.status)} />
                  <span className="capitalize">{deal.transaction_type}</span> · {deal.property?.title}
                </span>
              }
              actions={d.can.transitions.length > 0 && (
                <ActionDialog
                  trigger={<Button>Change status</Button>}
                  title="Change deal status"
                  description="Closing a deal as won needs the final price and at least one agreed brokerage amount. It does not mark any brokerage as paid — record payments separately."
                  confirmLabel="Update"
                  onConfirm={async (fd) => run(() => api.post(`/team/deals/${id}/status`, { status: fd.get('status'), reason: fd.get('reason') || null }), 'Deal status updated')}
                >
                  <select name="status" className={selectClass} aria-label="New status">
                    {d.can.transitions.map((s) => <option key={s} value={s}>{dealStatusBadge(s).label}</option>)}
                  </select>
                  <Textarea name="reason" placeholder="Reason (required for lost / cancelled)" />
                </ActionDialog>
              )}
            />

            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatCard label="Estimated brokerage" value={formatMoney(deal.estimated_brokerage)} hint="From the rule — not revenue" />
              <StatCard label="Agreed" value={formatMoney(deal.totals?.agreed)} />
              <StatCard label="Invoiced" value={formatMoney(deal.totals?.invoiced)} />
              <StatCard label="Collected (net)" value={formatMoney(Number(deal.totals?.received ?? 0) - Number(deal.totals?.refunded ?? 0))} tone="success" />
              <StatCard label="Outstanding" value={formatMoney(deal.totals?.outstanding)} tone="warning" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                {/* Brokerage basis */}
                <Section
                  title={<span className="flex items-center gap-2"><Calculator className="h-5 w-5 text-accent" /> Brokerage calculation</span>}
                  actions={open && <Button size="sm" variant="ghost" onClick={() => run(() => api.post(`/team/deals/${id}/reapply-rule`), 'Rule re-applied')}>Re-apply current rule</Button>}
                >
                  <p className="text-sm">{deal.brokerage_basis?.explanation ?? 'No estimate.'}</p>
                  {deal.brokerage_basis?.shares && Object.keys(deal.brokerage_basis.shares).length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Estimated split: {Object.entries(deal.brokerage_basis.shares).map(([p, a]) => `${p} ${formatMoney(a)}`).join(' · ')}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Estimates update when the final price changes. Agreed amounts below never change automatically.
                  </p>
                </Section>

                {/* Agreements */}
                <Section
                  title="Brokerage agreements (per responsible party)"
                  actions={!lost && freeParties.length > 0 && (
                    <ActionDialog
                      trigger={<Button size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Add party</Button>}
                      title="Add responsible party"
                      confirmLabel="Add"
                      onConfirm={async (fd) => run(() => api.post(`/team/deals/${id}/agreements`, {
                        party: fd.get('party'), party_name: fd.get('party_name') || null, agreed_amount: moneyOrNull(fd.get('agreed_amount')),
                        override_reason: fd.get('override_reason') || null, due_date: fd.get('due_date') || null,
                      }), 'Party added')}
                    >
                      <select name="party" className={selectClass} aria-label="Party">
                        {freeParties.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
                      </select>
                      <Input name="party_name" placeholder="Name" aria-label="Party name" />
                      <Input name="agreed_amount" type="number" min={0} step="0.01" placeholder="Agreed brokerage (₹)" aria-label="Agreed amount" />
                      <Input name="override_reason" placeholder="Reason, if different from the rule estimate" aria-label="Override reason" />
                      <Field label="Due date" htmlFor="ag-due"><Input id="ag-due" name="due_date" type="date" /></Field>
                    </ActionDialog>
                  )}
                >
                  {agreements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No responsible party yet. Add the party (or parties) who will pay brokerage.</p>
                  ) : (
                    <div className="space-y-4">
                      {agreements.map((a) => (
                        <AgreementCard key={a.id} agreement={a} deal={deal} canFinance={d.can.manage_finance} methods={d.options.payment_methods} onChanged={reload} />
                      ))}
                    </div>
                  )}
                </Section>

                <DocumentsSection deal={deal} onChanged={reload} />

                <Section title="Audit trail">
                  {d.audit.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded.</p> : (
                    <ul className="space-y-2 text-sm">
                      {d.audit.map((log) => (
                        <li key={log.id} className="border-b border-border pb-2 last:border-0">
                          <p className="text-xs text-muted-foreground">{formatDateTime(log.created_at)} · {log.user?.name ?? 'System'}</p>
                          <p><span className="font-medium">{log.action}</span>{log.reason && <> — {log.reason}</>}</p>
                          {log.new_values && (
                            <p className="break-all text-xs text-muted-foreground">
                              {Object.entries(log.new_values).map(([k, v]) => `${k}: ${log.old_values?.[k] !== undefined ? `${String(log.old_values[k])} → ` : ''}${String(v)}`).join(' · ')}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>

              {/* Right: terms */}
              <div className="space-y-6">
                <Section
                  title="Terms"
                  actions={
                    <ActionDialog
                      trigger={<Button size="sm" variant="ghost" className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
                      title="Edit deal terms"
                      description={open ? 'Changing the final price recalculates the estimate only.' : 'The final price of a closed deal cannot be changed.'}
                      confirmLabel="Save"
                      onConfirm={async (fd) => run(() => api.put(`/team/deals/${id}`, {
                        ...(open ? { final_price: moneyOrNull(fd.get('final_price')) } : {}),
                        security_deposit: moneyOrNull(fd.get('security_deposit')),
                        lease_start_date: fd.get('lease_start_date') || null,
                        lease_term_months: fd.get('lease_term_months') ? Number(fd.get('lease_term_months')) : null,
                        agreement_date: fd.get('agreement_date') || null,
                        negotiation_notes: fd.get('negotiation_notes') || null,
                      }), 'Terms saved')}
                    >
                      <Field label={rent ? 'Final monthly rent (₹)' : 'Final sale price (₹)'} htmlFor="t-final">
                        <Input id="t-final" name="final_price" type="number" min={1} step="0.01" disabled={!open} defaultValue={deal.final_price ? Number(deal.final_price) : ''} />
                      </Field>
                      {rent && (
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Security deposit (₹)" htmlFor="t-dep"><Input id="t-dep" name="security_deposit" type="number" min={0} defaultValue={deal.security_deposit ? Number(deal.security_deposit) : ''} /></Field>
                          <Field label="Lease term (months)" htmlFor="t-term"><Input id="t-term" name="lease_term_months" type="number" min={1} defaultValue={deal.lease_term_months ?? ''} /></Field>
                          <Field label="Lease start" htmlFor="t-start"><Input id="t-start" name="lease_start_date" type="date" defaultValue={deal.lease_start_date ?? ''} /></Field>
                        </div>
                      )}
                      <Field label="Agreement date" htmlFor="t-agr"><Input id="t-agr" name="agreement_date" type="date" defaultValue={deal.agreement_date ?? ''} /></Field>
                      <Textarea name="negotiation_notes" defaultValue={deal.negotiation_notes ?? ''} placeholder="Negotiation notes" rows={4} />
                    </ActionDialog>
                  }
                >
                  <dl>
                    <DetailRow label="Asking price">{formatPrice(deal.asking_price, deal.transaction_type)}</DetailRow>
                    <DetailRow label={rent ? 'Final rent' : 'Final price'}>{deal.final_price ? formatPrice(deal.final_price, deal.transaction_type) : '—'}</DetailRow>
                    {rent && <DetailRow label="Security deposit">{deal.security_deposit ? formatPrice(deal.security_deposit) : '—'}</DetailRow>}
                    {rent && <DetailRow label="Lease">{deal.lease_term_months ? `${deal.lease_term_months} months from ${formatDate(deal.lease_start_date)}` : '—'}</DetailRow>}
                    <DetailRow label="Agreement date">{formatDate(deal.agreement_date)}</DetailRow>
                    <DetailRow label="Closed">{formatDateTime(deal.closed_at)}</DetailRow>
                    {deal.closed_reason && <DetailRow label="Reason">{deal.closed_reason}</DetailRow>}
                    <DetailRow label="Handled by">{deal.assignee?.name ?? '—'}</DetailRow>
                  </dl>
                  {deal.negotiation_notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-muted p-3 text-sm">{deal.negotiation_notes}</p>}
                  <p className="mt-3 text-xs text-muted-foreground">Rent, deposit and sale price are paid between the parties. They are recorded here for reference and are never counted as Jalaram revenue.</p>
                </Section>

                <Section title="Parties">
                  <dl>
                    <DetailRow label="Customer">{deal.lead ? <Link href={`/team/leads/${deal.lead.id}`} className="text-primary hover:underline">{deal.customer_name}</Link> : deal.customer_name}</DetailRow>
                    <DetailRow label="Customer phone">{deal.customer_phone ?? '—'}</DetailRow>
                    <DetailRow label="Property">{deal.property ? <Link href={`/team/properties/${deal.property.id}`} className="text-primary hover:underline">{deal.property.reference_code}</Link> : '—'}</DetailRow>
                    <DetailRow label="Owner contact">{deal.property?.coordination_contact.name ?? '—'}</DetailRow>
                    <DetailRow label="Owner phone">{deal.property?.coordination_contact.phone ?? '—'}</DetailRow>
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

function AgreementCard({ agreement: a, deal, canFinance, methods, onChanged }: {
  agreement: BrokerageAgreement; deal: Deal; canFinance: boolean; methods: string[]; onChanged: () => void;
}) {
  const run = async (fn: () => Promise<unknown>, message: string) => {
    await fn();
    toast({ title: message });
    onChanged();
  };
  const cancelled = a.status === 'cancelled';
  const agreed = a.agreed_amount !== null;
  const lost = ['closed_lost', 'cancelled'].includes(deal.status);

  return (
    <div className={`rounded-xl border p-4 ${cancelled ? 'border-dashed border-border opacity-70' : 'border-border'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold capitalize">{a.party}{a.party_name && <span className="font-normal text-muted-foreground"> · {a.party_name}</span>}</p>
          <p className="text-xs text-muted-foreground">{a.party_phone}</p>
        </div>
        <StatusBadge {...agreementStatusBadge(a.status)} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-muted-foreground">Estimate</dt><dd className="tabular-nums">{formatMoney(a.estimated_amount)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Agreed</dt><dd className="font-semibold tabular-nums">{formatMoney(a.agreed_amount)}{a.is_override && <span className="ml-1 text-xs text-amber-700">(override)</span>}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Due</dt><dd>{formatDate(a.due_date)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Invoiced</dt><dd className="tabular-nums">{formatMoney(a.invoiced_amount)}{a.invoice_number && <span className="block text-xs text-muted-foreground">{a.invoice_number} · {formatDate(a.invoice_date)}</span>}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Received / refunded</dt><dd className="tabular-nums">{formatMoney(a.amount_received)} / {formatMoney(a.amount_refunded)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Outstanding</dt><dd className="font-semibold tabular-nums text-amber-800">{formatMoney(a.outstanding_amount)}</dd></div>
      </dl>
      {a.override_reason && <p className="mt-2 text-xs">Override reason: {a.override_reason}</p>}
      {a.cancelled_reason && <p className="mt-2 text-xs">Cancelled: {a.cancelled_reason}</p>}
      {Number(a.amount_waived) > 0 && <p className="mt-1 text-xs">Waived: {formatMoney(a.amount_waived)}</p>}

      {!cancelled && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!lost && (!agreed || canFinance) && (
            <ActionDialog
              trigger={<Button size="sm" variant={agreed ? 'outline' : 'default'}>{agreed ? 'Change agreed amount' : 'Record agreed brokerage'}</Button>}
              title={agreed ? 'Change agreed brokerage' : 'Record agreed brokerage'}
              description={agreed ? 'Changing an agreed amount is audited and needs a reason.' : `Rule estimate: ${formatMoney(a.estimated_amount)}. A different amount needs a reason.`}
              confirmLabel="Save"
              onConfirm={async (fd) => run(() => api.patch(`/team/agreements/${a.id}`, {
                agreed_amount: String(fd.get('agreed_amount')),
                override_reason: fd.get('reason') || null, reason: fd.get('reason') || null,
                due_date: fd.get('due_date') || null, party_name: fd.get('party_name') || a.party_name,
              }), 'Agreed brokerage saved')}
            >
              <Field label="Agreed amount (₹)" htmlFor={`ag-amt-${a.id}`}>
                <Input id={`ag-amt-${a.id}`} name="agreed_amount" type="number" min={0} step="0.01" required defaultValue={a.agreed_amount ?? a.estimated_amount ?? ''} />
              </Field>
              <Input name="reason" placeholder="Reason (needed if it differs from the estimate or is being changed)" aria-label="Reason" />
              <Input name="party_name" placeholder="Party name" defaultValue={a.party_name ?? ''} aria-label="Party name" />
              <Field label="Due date" htmlFor={`ag-due-${a.id}`}><Input id={`ag-due-${a.id}`} name="due_date" type="date" defaultValue={a.due_date ?? ''} /></Field>
            </ActionDialog>
          )}
          {agreed && (
            <ActionDialog
              trigger={<Button size="sm" variant="outline">Invoice reference</Button>}
              title="Invoice reference"
              confirmLabel="Save"
              onConfirm={async (fd) => run(() => api.patch(`/team/agreements/${a.id}`, {
                invoice_number: fd.get('invoice_number') || null, invoice_date: fd.get('invoice_date') || null,
                invoiced_amount: moneyOrNull(fd.get('invoiced_amount')) ?? '0',
              }), 'Invoice saved')}
            >
              <Input name="invoice_number" placeholder="Invoice number" defaultValue={a.invoice_number ?? ''} aria-label="Invoice number" />
              <Field label="Invoice date" htmlFor={`inv-date-${a.id}`}><Input id={`inv-date-${a.id}`} name="invoice_date" type="date" defaultValue={a.invoice_date ?? todayISO()} /></Field>
              <Field label="Invoiced amount (₹)" htmlFor={`inv-amt-${a.id}`}><Input id={`inv-amt-${a.id}`} name="invoiced_amount" type="number" min={0} step="0.01" defaultValue={Number(a.invoiced_amount) || a.agreed_amount || ''} /></Field>
            </ActionDialog>
          )}
          {agreed && canFinance && (
            <ActionDialog
              trigger={<Button size="sm">Record payment / refund / waiver</Button>}
              title="Ledger entry"
              description={`Outstanding: ${formatMoney(a.outstanding_amount)}. Entries cannot be deleted — void them instead.`}
              confirmLabel="Record"
              onConfirm={async (fd) => run(() => api.post(`/team/agreements/${a.id}/payments`, {
                type: fd.get('type'), amount: String(fd.get('amount')), payment_date: fd.get('payment_date'),
                method: fd.get('method') || null, reference_number: fd.get('reference_number') || null,
                receipt_number: fd.get('receipt_number') || null, notes: fd.get('notes') || null,
              }), 'Entry recorded')}
            >
              <div className="grid grid-cols-2 gap-3">
                <select name="type" className={selectClass} aria-label="Entry type">
                  <option value="payment">Payment received</option>
                  <option value="refund">Refund paid out</option>
                  <option value="waiver">Waiver</option>
                </select>
                <Input name="amount" type="number" min={0.01} step="0.01" required placeholder="Amount (₹)" defaultValue={Number(a.outstanding_amount) || ''} aria-label="Amount" />
                <Input name="payment_date" type="date" required max={todayISO()} defaultValue={todayISO()} aria-label="Date" />
                <select name="method" className={selectClass} aria-label="Method" defaultValue="upi">
                  <option value="">Method</option>
                  {methods.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
                </select>
                <Input name="reference_number" placeholder="Transaction / cheque ref" aria-label="Reference" />
                <Input name="receipt_number" placeholder="Receipt number" aria-label="Receipt number" />
              </div>
              <Textarea name="notes" placeholder="Notes (required for refunds and waivers)" />
            </ActionDialog>
          )}
          {canFinance && Number(a.amount_received) - Number(a.amount_refunded) === 0 ? (
            <ActionDialog
              trigger={<Button size="sm" variant="ghost" className="text-destructive">Cancel agreement</Button>}
              title="Cancel this brokerage agreement?"
              confirmLabel="Cancel agreement"
              destructive
              onConfirm={async (fd) => run(() => api.patch(`/team/agreements/${a.id}`, { cancel: true, reason: fd.get('reason') }), 'Agreement cancelled')}
            >
              <Textarea name="reason" required placeholder="Reason" />
            </ActionDialog>
          ) : null}
        </div>
      )}

      {a.payments && a.payments.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-1.5">Date</th><th>Type</th><th className="text-right">Amount</th><th>Method / ref</th><th>By</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {a.payments.map((p) => (
                <tr key={p.id} className={p.voided_at ? 'text-muted-foreground line-through' : ''}>
                  <td className="py-1.5">{formatDate(p.payment_date)}</td>
                  <td className="capitalize">{p.type}</td>
                  <td className="text-right tabular-nums">{p.type === 'refund' ? '−' : ''}{formatMoney(p.amount)}</td>
                  <td>{humanize(p.method)} {p.reference_number && `· ${p.reference_number}`} {p.receipt_number && `· Rcpt ${p.receipt_number}`}</td>
                  <td>{p.recorded_by?.name}</td>
                  <td className="text-right no-underline">
                    {p.voided_at ? <span className="no-underline" title={p.void_reason ?? ''}>void</span> : canFinance && (
                      <ActionDialog trigger={<button className="text-destructive hover:underline">Void</button>} title="Void ledger entry" confirmLabel="Void" destructive
                        onConfirm={async (fd) => run(() => api.post(`/team/payments/${p.id}/void`, { reason: fd.get('reason') }), 'Entry voided')}>
                        <Textarea name="reason" required placeholder="Why is this entry being voided?" />
                      </ActionDialog>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DocumentsSection({ deal, onChanged }: { deal: Deal; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  const upload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!(fd.get('file') as File)?.size) fd.delete('file');
    setBusy(true);
    try {
      await api.post(`/team/deals/${deal.id}/documents`, fd);
      form.reset();
      toast({ title: 'Document added' });
      onChanged();
    } catch (err) {
      toast({ title: 'Upload failed', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Documents & references">
      <form onSubmit={upload} className="mb-4 grid gap-2 sm:grid-cols-[140px_1fr_1fr_auto]">
        <select name="type" className={selectClass} aria-label="Document type">
          {DOC_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
        </select>
        <Input name="title" required placeholder="Title, e.g. Leave & licence agreement" aria-label="Title" />
        <Input name="file" type="file" accept="application/pdf,image/jpeg,image/png" aria-label="File (optional, PDF/JPG/PNG up to 10 MB)" />
        <Button type="submit" disabled={busy} className="gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Add</Button>
        <Input name="reference_number" placeholder="Reference number (optional)" className="sm:col-span-2" aria-label="Reference number" />
      </form>
      {(deal.documents ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No documents yet.</p> : (
        <ul className="divide-y divide-border text-sm">
          {deal.documents!.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{humanize(doc.type)}{doc.reference_number && ` · ${doc.reference_number}`} · {doc.uploaded_by?.name} · {formatDate(doc.created_at)}</p>
              </div>
              <div className="flex gap-1">
                {doc.has_file && (
                  <Button asChild size="icon" variant="ghost" aria-label={`Download ${doc.title}`}>
                    <a href={`/api/v1/team/documents/${doc.id}/download`}><Download className="h-4 w-4" /></a>
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Delete ${doc.title}`} onClick={async () => {
                  if (!window.confirm('Delete this document?')) return;
                  try { await api.delete(`/team/documents/${doc.id}`); onChanged(); } catch (err) { toast({ title: 'Delete failed', description: errorMessage(err), variant: 'destructive' }); }
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
