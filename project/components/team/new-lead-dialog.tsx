'use client';

import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ActionDialog } from '@/components/shared/action-dialog';
import { Field, selectClass } from '@/components/shared/form-field';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import { toast } from '@/hooks/use-toast';
import type { Lead } from '@/lib/types';

/** Enter a lead received by phone, walk-in, referral etc. */
export function NewLeadDialog() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <ActionDialog
      trigger={<Button className="gap-2"><Plus className="h-4 w-4" /> New lead</Button>}
      title="Add a lead"
      description="For enquiries received outside the website. Website enquiries are added automatically."
      confirmLabel="Create lead"
      onConfirm={async (fd) => {
        const res = await api.post<{ data: Lead }>('/team/leads', {
          name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email') || null,
          interest: fd.get('interest'), source: fd.get('source'), message: fd.get('message') || null,
          budget_min: fd.get('budget_min') || null, budget_max: fd.get('budget_max') || null,
          assigned_to: fd.get('assign_me') === 'on' ? user?.id : null,
        });
        toast({ title: `Lead ${res.data.reference_code} created` });
        router.push(`/team/leads/${res.data.id}`);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *" htmlFor="nl-name"><Input id="nl-name" name="name" required /></Field>
        <Field label="Phone *" htmlFor="nl-phone"><Input id="nl-phone" name="phone" type="tel" required /></Field>
        <Field label="Email" htmlFor="nl-email"><Input id="nl-email" name="email" type="email" /></Field>
        <Field label="Interest" htmlFor="nl-interest">
          <select id="nl-interest" name="interest" className={selectClass} defaultValue="buy">
            {['buy', 'rent', 'sell', 'general'].map((i) => <option key={i} value={i}>{humanize(i)}</option>)}
          </select>
        </Field>
        <Field label="Source" htmlFor="nl-source">
          <select id="nl-source" name="source" className={selectClass} defaultValue="phone">
            {['phone', 'whatsapp', 'walk_in', 'referral', 'social', 'other'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Budget min" htmlFor="nl-bmin"><Input id="nl-bmin" name="budget_min" type="number" min={0} /></Field>
          <Field label="Budget max" htmlFor="nl-bmax"><Input id="nl-bmax" name="budget_max" type="number" min={0} /></Field>
        </div>
      </div>
      <Textarea name="message" placeholder="Requirement / notes" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="assign_me" defaultChecked /> Assign to me</label>
    </ActionDialog>
  );
}
