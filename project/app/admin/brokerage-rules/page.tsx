'use client';

import { useEffect, useState } from 'react';
import { Calculator, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState, EmptyState } from '@/components/shared/states';
import { Section } from '@/components/shared/section';
import { ActionDialog } from '@/components/shared/action-dialog';
import { Field, selectClass } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/hooks/use-api';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatDate, formatMoney, humanize, PROPERTY_TYPES, todayISO } from '@/lib/format';
import type { BrokerageEstimate, BrokerageRule, Locality } from '@/lib/types';

const BASIS_LABEL: Record<string, string> = {
  monthly_rent: 'monthly rent', annual_rent: 'annual rent', final_sale_price: 'final sale price', asking_price: 'asking price',
};

function describe(r: BrokerageRule) {
  const amount = r.method === 'fixed' ? formatMoney(r.fixed_amount)
    : r.method === 'percentage' ? `${Number(r.percentage)}% of ${BASIS_LABEL[r.percentage_basis ?? ''] ?? '—'}`
    : 'Negotiated per deal';
  const payer = r.payer === 'split' ? Object.entries(r.split_shares ?? {}).map(([p, s]) => `${p} ${s}%`).join(' / ') : r.payer;
  return `${amount} · paid by ${payer}`;
}

/** Rule form. Uses controlled method/payer/type so only relevant fields show. */
function RuleFields({ rule, localities }: { rule?: BrokerageRule; localities: Locality[] }) {
  const [type, setType] = useState(rule?.transaction_type ?? 'rent');
  const [method, setMethod] = useState(rule?.method ?? 'fixed');
  const [payer, setPayer] = useState(rule?.payer ?? 'tenant');
  const parties = type === 'rent' ? ['owner', 'tenant'] : ['seller', 'buyer'];
  const bases = type === 'rent' ? ['monthly_rent', 'annual_rent', 'asking_price'] : ['final_sale_price', 'asking_price'];
  const k = rule?.id ?? 'new';

  return (
    <div className="space-y-3">
      <Field label="Rule name" htmlFor={`r-name-${k}`}><Input id={`r-name-${k}`} name="name" required defaultValue={rule?.name} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Transaction" htmlFor={`r-type-${k}`}>
          <select id={`r-type-${k}`} name="transaction_type" className={selectClass} value={type} onChange={(e) => { setType(e.target.value as 'rent' | 'sale'); setPayer(e.target.value === 'rent' ? 'tenant' : 'buyer'); }}>
            <option value="rent">Rent</option><option value="sale">Sale</option>
          </select>
        </Field>
        <Field label="Method" htmlFor={`r-method-${k}`}>
          <select id={`r-method-${k}`} name="method" className={selectClass} value={method} onChange={(e) => setMethod(e.target.value as BrokerageRule['method'])}>
            <option value="fixed">Fixed amount</option><option value="percentage">Percentage</option><option value="negotiated">Negotiated per deal</option>
          </select>
        </Field>
        <Field label="Payer" htmlFor={`r-payer-${k}`}>
          <select id={`r-payer-${k}`} name="payer" className={selectClass} value={payer} onChange={(e) => setPayer(e.target.value as BrokerageRule['payer'])}>
            {parties.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
            <option value="split">Split between both</option>
          </select>
        </Field>
      </div>
      {method === 'fixed' && <Field label="Fixed amount (₹)" htmlFor={`r-fixed-${k}`}><Input id={`r-fixed-${k}`} name="fixed_amount" type="number" min={0} step="0.01" required defaultValue={rule?.fixed_amount ?? ''} /></Field>}
      {method === 'percentage' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Percentage" htmlFor={`r-pct-${k}`} hint="e.g. 1 for 1%, 100 for one month's rent"><Input id={`r-pct-${k}`} name="percentage" type="number" min={0.0001} max={100} step="0.0001" required defaultValue={rule?.percentage ? Number(rule.percentage) : ''} /></Field>
          <Field label="Of" htmlFor={`r-basis-${k}`}>
            <select id={`r-basis-${k}`} name="percentage_basis" className={selectClass} defaultValue={rule?.percentage_basis ?? bases[0]} key={type}>
              {bases.map((b) => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}
            </select>
          </Field>
        </div>
      )}
      {method !== 'negotiated' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minimum (₹, optional)" htmlFor={`r-min-${k}`}><Input id={`r-min-${k}`} name="min_amount" type="number" min={0} defaultValue={rule?.min_amount ?? ''} /></Field>
          <Field label="Maximum (₹, optional)" htmlFor={`r-max-${k}`}><Input id={`r-max-${k}`} name="max_amount" type="number" min={0} defaultValue={rule?.max_amount ?? ''} /></Field>
        </div>
      )}
      {payer === 'split' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {parties.map((p) => (
            <Field key={p} label={`${humanize(p)} share (%)`} htmlFor={`r-split-${p}-${k}`}>
              <Input id={`r-split-${p}-${k}`} name={`split_${p}`} type="number" min={1} max={99} required defaultValue={rule?.split_shares?.[p] ?? 50} />
            </Field>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Only for property type" htmlFor={`r-pt-${k}`}>
          <select id={`r-pt-${k}`} name="property_type" className={selectClass} defaultValue={rule?.property_type ?? ''}>
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Only for locality" htmlFor={`r-loc-${k}`}>
          <select id={`r-loc-${k}`} name="locality_id" className={selectClass} defaultValue={rule?.locality_id ?? ''}>
            <option value="">Any locality</option>
            {localities.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <Field label="Effective from" htmlFor={`r-from-${k}`}><Input id={`r-from-${k}`} name="effective_from" type="date" required defaultValue={rule?.effective_from ?? todayISO()} /></Field>
        <Field label="Effective to (optional)" htmlFor={`r-to-${k}`}><Input id={`r-to-${k}`} name="effective_to" type="date" defaultValue={rule?.effective_to ?? ''} /></Field>
        <Field label="Priority" htmlFor={`r-pri-${k}`} hint="Breaks ties between equally specific rules."><Input id={`r-pri-${k}`} name="priority" type="number" min={-100} max={100} defaultValue={rule?.priority ?? 0} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={rule?.is_active ?? true} /> Active</label>
      </div>
      <Textarea name="notes" placeholder="Notes" defaultValue={rule?.notes ?? ''} />
      {rule && <Input name="change_reason" required placeholder="Reason for this change (required, audited)" aria-label="Reason for change" />}
    </div>
  );
}

function payloadFrom(fd: FormData) {
  const payer = String(fd.get('payer'));
  const type = String(fd.get('transaction_type'));
  const parties = type === 'rent' ? ['owner', 'tenant'] : ['seller', 'buyer'];
  const opt = (k: string) => (fd.get(k) === null || fd.get(k) === '' ? null : String(fd.get(k)));
  return {
    name: fd.get('name'), transaction_type: type, method: fd.get('method'), payer,
    fixed_amount: opt('fixed_amount'), percentage: opt('percentage'), percentage_basis: opt('percentage_basis'),
    min_amount: opt('min_amount'), max_amount: opt('max_amount'),
    split_shares: payer === 'split' ? Object.fromEntries(parties.map((p) => [p, Number(fd.get(`split_${p}`))])) : null,
    property_type: opt('property_type'), locality_id: opt('locality_id') ? Number(fd.get('locality_id')) : null,
    effective_from: fd.get('effective_from'), effective_to: opt('effective_to'), priority: Number(fd.get('priority') || 0),
    is_active: fd.get('is_active') === 'on', notes: opt('notes'), change_reason: opt('change_reason'),
  };
}

function Preview() {
  const [result, setResult] = useState<BrokerageEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Section title={<span className="flex items-center gap-2"><Calculator className="h-5 w-5 text-accent" /> Try a calculation</span>}>
      <form className="grid gap-3 sm:grid-cols-4" onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        try {
          const res = await api.post<{ data: BrokerageEstimate }>('/admin/brokerage-rules/preview', {
            transaction_type: fd.get('transaction_type'), property_type: fd.get('property_type') || null,
            asking_price: fd.get('asking_price'), final_price: fd.get('final_price') || null,
          });
          setResult(res.data);
        } catch (err) { setError(errorMessage(err)); }
      }}>
        <select name="transaction_type" className={selectClass} aria-label="Transaction"><option value="rent">Rent</option><option value="sale">Sale</option></select>
        <select name="property_type" className={selectClass} aria-label="Property type"><option value="">Any type</option>{PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        <Input name="asking_price" type="number" min={0} required placeholder="Asking price / rent" aria-label="Asking price" />
        <Input name="final_price" type="number" min={0} placeholder="Final price / rent" aria-label="Final price" />
        <Button type="submit" variant="outline" className="sm:col-span-4 sm:justify-self-start">Calculate</Button>
      </form>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {result && (
        <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
          <p className="font-semibold">Estimate: {result.total ? formatMoney(result.total) : 'negotiated / no rule'}</p>
          <p className="mt-1 text-muted-foreground">{result.explanation}</p>
        </div>
      )}
    </Section>
  );
}

export default function BrokerageRulesPage() {
  const { data, loading, error, reload } = useApi<{ data: BrokerageRule[] }>('/admin/brokerage-rules');
  const [localities, setLocalities] = useState<Locality[]>([]);
  useEffect(() => { api.get<{ data: Locality[] }>('/admin/localities').then((r) => setLocalities(r.data)).catch(() => undefined); }, []);

  return (
    <>
      <PageHeader
        title="Brokerage rules"
        description="Rules produce estimates only. The amount each party actually agrees is recorded on the deal and always takes precedence."
        actions={
          <ActionDialog trigger={<Button className="gap-2"><Plus className="h-4 w-4" /> New rule</Button>} title="New brokerage rule" confirmLabel="Create"
            onConfirm={async (fd) => { await api.post('/admin/brokerage-rules', payloadFrom(fd)); toast({ title: 'Rule created' }); reload(); }}>
            <RuleFields localities={localities} />
          </ActionDialog>
        }
      />
      <div className="space-y-6">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Most specific active rule wins: locality + property type, then locality, then type, then general. Configure taxes (e.g. GST) only after professional advice.
        </p>
        <DataState loading={loading} error={error} data={data} onRetry={reload}>
          {({ data: rules }) => rules.length === 0 ? (
            <EmptyState title="No rules yet" description="Without a rule, deals have no estimate and brokerage is entered manually." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {rules.map((r) => (
                <div key={r.id} className={`rounded-xl border bg-card p-4 ${r.is_active ? 'border-border' : 'border-dashed border-border opacity-70'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{r.transaction_type} · {r.is_active ? 'active' : 'inactive'} · priority {r.priority}</p>
                    </div>
                    <div className="flex gap-1">
                      <ActionDialog trigger={<Button size="sm" variant="outline">Edit</Button>} title="Edit brokerage rule" confirmLabel="Save"
                        description="Existing deals keep their snapshot; use 'Re-apply current rule' on an open deal to refresh its estimate."
                        onConfirm={async (fd) => { await api.put(`/admin/brokerage-rules/${r.id}`, payloadFrom(fd)); toast({ title: 'Rule updated' }); reload(); }}>
                        <RuleFields rule={r} localities={localities} />
                      </ActionDialog>
                      <ActionDialog trigger={<Button size="icon" variant="ghost" className="text-destructive" aria-label={`Delete ${r.name}`}><Trash2 className="h-4 w-4" /></Button>}
                        title="Delete rule?" confirmLabel="Delete" destructive
                        onConfirm={async (fd) => { await api.delete(`/admin/brokerage-rules/${r.id}`, { reason: fd.get('reason') }); toast({ title: 'Rule deleted' }); reload(); }}>
                        <Input name="reason" required placeholder="Reason (audited)" aria-label="Reason" />
                      </ActionDialog>
                    </div>
                  </div>
                  <p className="mt-2 text-sm">{describe(r)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.property_type ? `${humanize(r.property_type)} only` : 'All types'} · {r.locality ? r.locality.name : 'All localities'} ·
                    {' '}from {formatDate(r.effective_from)}{r.effective_to ? ` to ${formatDate(r.effective_to)}` : ''}
                    {r.min_amount && ` · min ${formatMoney(r.min_amount)}`}{r.max_amount && ` · max ${formatMoney(r.max_amount)}`}
                  </p>
                  {r.notes && <p className="mt-2 text-xs">{r.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </DataState>
        <Preview />
      </div>
    </>
  );
}
