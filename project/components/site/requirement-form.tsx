'use client';

import { useId, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Send } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { VoiceInputButton } from '@/components/shared/voice-input-button';
import { whatsappLink } from '@/lib/business';
import { usePublicSettings } from '@/lib/settings-context';
import { cn } from '@/lib/utils';
import type { Locality } from '@/lib/types';

type Purpose = 'buy' | 'rent';

/** Budget bands in rupees ([min, max], null = open-ended). */
const BUDGETS: Record<Purpose, { label: string; range: [number | null, number | null] }[]> = {
  buy: [
    { label: 'Under ₹25 L', range: [null, 2500000] },
    { label: '₹25 – 50 L', range: [2500000, 5000000] },
    { label: '₹50 L – 1 Cr', range: [5000000, 10000000] },
    { label: '₹1 – 2 Cr', range: [10000000, 20000000] },
    { label: 'Above ₹2 Cr', range: [20000000, null] },
  ],
  rent: [
    { label: 'Under ₹10,000', range: [null, 10000] },
    { label: '₹10,000 – 20,000', range: [10000, 20000] },
    { label: '₹20,000 – 35,000', range: [20000, 35000] },
    { label: '₹35,000 – 60,000', range: [35000, 60000] },
    { label: 'Above ₹60,000', range: [60000, null] },
  ],
};
const BHK_OPTIONS = ['1', '2', '3', '4', '5'];
const OTHER_AREA = '__other';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function utmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach((k) => {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 100);
  });
  return out;
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-muted'
      )}
    >
      {children}
    </button>
  );
}

/** Quick requirement form for social media visitors. Creates a lead in the team portal. */
export function RequirementForm({ localities }: { localities: Locality[] }) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const settings = usePublicSettings();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState<Purpose>('buy');
  const [bhk, setBhk] = useState('');
  const [area, setArea] = useState('');
  const [otherArea, setOtherArea] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const budgets = BUDGETS[purpose];
  const chosenBudget = budget === '' ? null : budgets[Number(budget)];
  const locality = localities.find((l) => String(l.id) === area);
  const areaName = area === OTHER_AREA ? otherArea.trim() : locality?.name ?? '';

  const summary = [
    `${bhk ? `${bhk === '5' ? '5+' : bhk} BHK` : 'Property'} to ${purpose}`,
    chosenBudget && `budget ${chosenBudget.label}`,
    areaName && `in ${areaName}`,
  ].filter(Boolean).join(', ');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    if (name.trim().length < 2) errors.name = 'Please enter your name.';
    if (phone.replace(/\D/g, '').length < 10) errors.phone = 'Enter a valid phone number with at least 10 digits.';
    if (!consent) errors.consent_contact = 'Please agree to be contacted about your requirement.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    const fd = new FormData(e.currentTarget);
    const [min, max] = chosenBudget?.range ?? [null, null];
    setLoading(true);
    try {
      const res = await api.post<{ data: { reference: string } }>('/enquiries', {
        name: name.trim(),
        phone: phone.trim(),
        interest: purpose,
        preferred_bhk: bhk ? Number(bhk) : null,
        preferred_locality_id: locality?.id ?? null,
        budget_min: min,
        budget_max: max,
        // The summary repeats the structured fields so the team can read the whole requirement at a glance.
        message: [`Requirement: ${summary}.`, notes.trim()].filter(Boolean).join('\n\n').slice(0, 2000),
        source_page: '/requirement',
        consent_contact: true,
        consent_marketing: false,
        website: fd.get('website') || '',
        ...utmParams(),
      });
      setReference(res.data.reference);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFieldErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
        setError('Please correct the highlighted fields.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (reference) {
    const whatsappHref = whatsappLink(settings, `Hi, I just shared my requirement on your website (Ref: ${reference}): ${summary}.`);
    return (
      <div className="py-4 text-center animate-fade-in" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h2 className="mt-4 font-serif text-xl font-semibold">Thank you, {name.trim().split(' ')[0]}!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We have your requirement ({summary}). Our team will contact you soon. Your reference is {reference}.
        </p>
        {whatsappHref && (
          <Button asChild className="mt-5 bg-green-600 hover:bg-green-700">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Chat with us on WhatsApp
            </a>
          </Button>
        )}
      </div>
    );
  }

  const fieldError = (key: string) =>
    fieldErrors[key] ? <p id={id(`${key}-error`)} className="text-xs text-destructive">{fieldErrors[key]}</p> : null;
  const voiceError = (key: string) => (message: string) => setFieldErrors((prev) => ({ ...prev, [key]: message }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Honeypot — hidden from people, filled in by bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor={id('website')}>Website</label>
        <input id={id('website')} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id('name')}>Your name *</Label>
        <div className="flex gap-2">
          <Input id={id('name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" placeholder="Type or tap the mic"
            aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? id('name-error') : undefined} />
          <VoiceInputButton label="name" onText={(text) => setName(text.slice(0, 120))} onError={voiceError('name')} />
        </div>
        {fieldError('name')}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id('phone')}>Mobile / WhatsApp number *</Label>
        <div className="flex gap-2">
          <Input id={id('phone')} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXX XXXXX"
            aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? id('phone-error') : undefined} />
          {/* Spoken numbers come back with spaces or words around them: keep digits and a leading +. */}
          <VoiceInputButton label="mobile number" onText={(text) => setPhone(text.replace(/[^\d+]/g, '').slice(0, 15))} onError={voiceError('phone')} />
        </div>
        {fieldError('phone')}
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">I want to</legend>
        <div className="flex gap-2">
          {(['buy', 'rent'] as const).map((p) => (
            <Chip key={p} selected={purpose === p} onClick={() => { setPurpose(p); setBudget(''); }}>
              {p === 'buy' ? 'Buy' : 'Rent'}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">BHK</legend>
        <div className="flex flex-wrap gap-2">
          {BHK_OPTIONS.map((b) => (
            <Chip key={b} selected={bhk === b} onClick={() => setBhk(bhk === b ? '' : b)}>
              {b === '5' ? '5+' : b} BHK
            </Chip>
          ))}
        </div>
        {fieldError('preferred_bhk')}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id('area')}>Preferred area</Label>
          <select id={id('area')} value={area} onChange={(e) => setArea(e.target.value)} className={selectClass}>
            <option value="">Any area</option>
            {localities.map((l) => (
              <option key={l.id} value={String(l.id)}>{l.name}</option>
            ))}
            <option value={OTHER_AREA}>Other (type it)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id('budget')}>{purpose === 'rent' ? 'Monthly rent' : 'Budget'}</Label>
          <select id={id('budget')} value={budget} onChange={(e) => setBudget(e.target.value)} className={selectClass}>
            <option value="">Not sure yet</option>
            {budgets.map((b, i) => (
              <option key={b.label} value={String(i)}>{b.label}</option>
            ))}
          </select>
        </div>
      </div>

      {area === OTHER_AREA && (
        <div className="space-y-1.5">
          <Label htmlFor={id('other-area')}>Area name</Label>
          <div className="flex gap-2">
            <Input id={id('other-area')} value={otherArea} onChange={(e) => setOtherArea(e.target.value)} maxLength={80} placeholder="e.g. Shela" />
            <VoiceInputButton label="area" onText={(text) => setOtherArea(text.slice(0, 80))} />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={id('notes')}>Anything else? (optional)</Label>
        <div className="flex gap-2">
          <Textarea id={id('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1500} rows={3}
            placeholder="e.g. near a school, ready to move, furnished…" />
          <VoiceInputButton label="requirement" onText={(text) => setNotes((prev) => (prev ? `${prev} ${text}` : text).slice(0, 1500))} onError={voiceError('notes')} />
        </div>
        {fieldError('notes')}
      </div>

      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <Checkbox id={id('consent')} checked={consent} onCheckedChange={(v) => setConsent(v === true)} aria-invalid={!!fieldErrors.consent_contact} />
          <Label htmlFor={id('consent')} className="text-xs font-normal leading-relaxed text-muted-foreground">
            I agree to be contacted by Jalaram Real Estate by call or WhatsApp about my requirement, as described in the{' '}
            <a href="/privacy-policy" className="underline" target="_blank">privacy policy</a>. *
          </Label>
        </div>
        {fieldError('consent_contact')}
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full gap-2 bg-primary py-6 text-base">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send my requirement</>}
      </Button>
    </form>
  );
}
