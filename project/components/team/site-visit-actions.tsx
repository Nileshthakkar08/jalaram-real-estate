'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ActionDialog } from '@/components/shared/action-dialog';
import { Field } from '@/components/shared/form-field';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { toDateTimeLocal } from '@/lib/format';
import type { SiteVisit } from '@/lib/types';

/** Schedule / confirm / complete / cancel actions for a site visit. */
export function SiteVisitActions({ visit, onChanged }: { visit: SiteVisit; onChanged: () => void }) {
  const patch = async (body: Record<string, unknown>, message: string) => {
    await api.patch(`/team/site-visits/${visit.id}`, body);
    toast({ title: message });
    onChanged();
  };

  // Pre-fill with the current schedule, or the customer's requested day and slot.
  const slotTime = visit.requested_slot === 'morning' ? '10:00' : visit.requested_slot === 'afternoon' ? '14:00' : '17:00';
  const defaultTime = visit.scheduled_at
    ? toDateTimeLocal(visit.scheduled_at)
    : visit.requested_date ? `${visit.requested_date}T${slotTime}` : '';

  return (
    <div className="flex flex-wrap gap-2">
      {['requested', 'scheduled', 'cancelled', 'no_show'].includes(visit.status) && (
        <ActionDialog
          trigger={<Button size="sm">{visit.status === 'scheduled' ? 'Reschedule' : 'Schedule'}</Button>}
          title={visit.status === 'scheduled' ? 'Reschedule visit' : 'Schedule visit'}
          description="Confirm the time with the owner and the customer before scheduling."
          confirmLabel="Save"
          onConfirm={async (fd) => patch({
            status: 'scheduled',
            scheduled_at: new Date(String(fd.get('scheduled_at'))).toISOString(),
            owner_confirmed: fd.get('owner_confirmed') === 'on',
            notes: fd.get('notes') || visit.notes,
          }, 'Visit scheduled')}
        >
          <Field label="Date and time" htmlFor={`sv-at-${visit.id}`}>
            <Input id={`sv-at-${visit.id}`} name="scheduled_at" type="datetime-local" required defaultValue={defaultTime} />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox id={`sv-oc-${visit.id}`} name="owner_confirmed" defaultChecked={visit.owner_confirmed} />
            <Label htmlFor={`sv-oc-${visit.id}`} className="font-normal">Owner has confirmed this time</Label>
          </div>
          <Textarea name="notes" placeholder="Notes (meeting point, keys, etc.)" defaultValue={visit.notes ?? ''} />
        </ActionDialog>
      )}
      {visit.status === 'scheduled' && !visit.owner_confirmed && (
        <Button size="sm" variant="outline" onClick={() => patch({ owner_confirmed: true }, 'Owner confirmation recorded')}>Owner confirmed</Button>
      )}
      {visit.status === 'scheduled' && (
        <>
          <ActionDialog
            trigger={<Button size="sm" variant="outline">Mark completed</Button>}
            title="Visit completed"
            confirmLabel="Save"
            onConfirm={async (fd) => patch({ status: 'completed', customer_feedback: fd.get('customer_feedback') || null }, 'Visit completed')}
          >
            <Textarea name="customer_feedback" placeholder="Customer feedback" />
          </ActionDialog>
          <Button size="sm" variant="ghost" onClick={() => patch({ status: 'no_show' }, 'Marked as no-show')}>No-show</Button>
        </>
      )}
      {['requested', 'scheduled'].includes(visit.status) && (
        <ActionDialog
          trigger={<Button size="sm" variant="ghost" className="text-destructive">Cancel</Button>}
          title="Cancel visit"
          confirmLabel="Cancel visit"
          destructive
          onConfirm={async (fd) => patch({ status: 'cancelled', notes: fd.get('notes') || visit.notes }, 'Visit cancelled')}
        >
          <Textarea name="notes" placeholder="Reason" />
        </ActionDialog>
      )}
    </div>
  );
}
