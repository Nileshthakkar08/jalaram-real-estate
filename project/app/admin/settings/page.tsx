'use client';

import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState } from '@/components/shared/states';
import { Section } from '@/components/shared/section';
import { Field } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi } from '@/hooks/use-api';
import { api, ApiError, errorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface Setting { key: string; value: string | null; is_public: boolean }

const META: Record<string, { label: string; hint?: string; type?: string }> = {
  business_phone: { label: 'Business phone', hint: 'Shown in the header, footer and call buttons, e.g. +91 79 XXXX XXXX.' },
  business_whatsapp: { label: 'WhatsApp number', hint: 'Digits with country code, no + or spaces, e.g. 9198XXXXXXXX. Enables WhatsApp buttons.' },
  business_email: { label: 'Business email', type: 'email' },
  business_address: { label: 'Office address' },
  business_hours: { label: 'Business hours', hint: 'e.g. Mon–Sat, 10:00 AM – 7:00 PM' },
  social_instagram: { label: 'Instagram URL', type: 'url' },
  social_facebook: { label: 'Facebook URL', type: 'url' },
  rera_registration: { label: 'RERA registration number', hint: 'Only enter a registration you actually hold.' },
  listing_validity_days: { label: 'Listing validity (days)', type: 'number', hint: 'Published listings expire after this many days. 0 = never.' },
  lead_notification_email: { label: 'Lead notification email', type: 'email', hint: 'Internal only.' },
};

export default function SettingsPage() {
  const { data, loading, error, reload } = useApi<{ data: Setting[] }>('/admin/settings');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const settings = Object.fromEntries((data?.data ?? []).map((s) => [s.key, String(fd.get(s.key) ?? '').trim() || null]));
    setBusy(true);
    setErrors({});
    try {
      await api.put('/admin/settings', { settings });
      toast({ title: 'Settings saved', description: 'Public pages refresh within a few minutes.' });
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k.replace('settings.', ''), v[0]])));
      else toast({ title: 'Could not save', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Contact details are hidden on the website until filled in. Never enter details you cannot verify." />
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {({ data: settings }) => (
          <form onSubmit={save} className="space-y-6">
            {[{ title: 'Public business details', pub: true }, { title: 'Internal', pub: false }].map((group) => (
              <Section key={group.title} title={group.title}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {settings.filter((s) => s.is_public === group.pub).map((s) => (
                    <Field key={s.key} label={META[s.key]?.label ?? s.key} htmlFor={`s-${s.key}`} hint={META[s.key]?.hint} error={errors[s.key]}>
                      <Input id={`s-${s.key}`} name={s.key} type={META[s.key]?.type ?? 'text'} defaultValue={s.value ?? ''} />
                    </Field>
                  ))}
                </div>
              </Section>
            ))}
            <div className="flex justify-end">
              <Button type="submit" disabled={busy} className="gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings</Button>
            </div>
          </form>
        )}
      </DataState>
    </>
  );
}
