'use client';

import { useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2, Send, CheckCircle2, CalendarCheck, Phone, MessageCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { callLink, whatsappLink } from '@/lib/business';
import { usePublicSettings } from '@/lib/settings-context';
import { todayISO } from '@/lib/format';
import type { LeadInterest } from '@/lib/types';

interface EnquiryFormProps {
  propertyId?: number;
  propertyTitle?: string;
  leadType?: LeadInterest;
  /** `visit` asks for a preferred date/slot and creates a site-visit request. */
  mode?: 'enquiry' | 'visit';
  compact?: boolean;
  showInterest?: boolean;
  submitLabel?: string;
}

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

/** All enquiries go to Jalaram's central lead system — never directly to the owner. */
export function EnquiryForm({
  propertyId,
  propertyTitle,
  leadType = 'general',
  mode = 'enquiry',
  compact = false,
  showInterest = false,
  submitLabel,
}: EnquiryFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const pathname = usePathname();
  const settings = usePublicSettings();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setFieldErrors({});

    if (!consent) {
      setFieldErrors({ consent_contact: 'Please agree to be contacted about your enquiry.' });
      return;
    }

    const fd = new FormData(form);
    const payload: Record<string, unknown> = {
      name: fd.get('name'),
      phone: fd.get('phone'),
      email: fd.get('email') || null,
      message: fd.get('message') || null,
      interest: fd.get('interest') || leadType,
      property_id: propertyId ?? null,
      source_page: pathname,
      consent_contact: true,
      consent_marketing: marketing,
      website: fd.get('website') || '',
      ...utmParams(),
    };
    if (mode === 'visit') {
      payload.preferred_date = fd.get('preferred_date');
      payload.preferred_slot = fd.get('preferred_slot') || null;
    }

    setLoading(true);
    try {
      const res = await api.post<{ data: { reference: string }; message: string }>(
        mode === 'visit' ? '/site-visit-requests' : '/enquiries',
        payload
      );
      setSuccess(`${res.message} Your reference is ${res.data.reference}.`);
      form.reset();
      setConsent(false);
      setMarketing(false);
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

  const phoneHref = callLink(settings);
  const whatsappHref = whatsappLink(settings, `Hello, I enquired about ${propertyTitle ?? 'a property'}.`);

  if (success) {
    return (
      <div className="rounded-xl border border-success/20 bg-success/5 p-6 text-center animate-fade-in" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h3 className="mt-4 font-serif text-lg font-semibold text-foreground">
          {mode === 'visit' ? 'Visit Request Received' : 'Enquiry Submitted'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{success}</p>
        {(phoneHref || whatsappHref) && (
          <div className="mt-4 flex justify-center gap-3">
            {phoneHref && (
              <Button asChild variant="outline" size="sm">
                <a href={phoneHref}><Phone className="mr-1.5 h-4 w-4" /> Call Now</a>
              </Button>
            )}
            {whatsappHref && (
              <Button asChild size="sm" className="bg-green-600 hover:bg-green-700">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                </a>
              </Button>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="mt-3 text-xs text-muted-foreground underline"
        >
          Submit another {mode === 'visit' ? 'request' : 'enquiry'}
        </button>
      </div>
    );
  }

  const fieldError = (name: string) =>
    fieldErrors[name] ? <p id={id(`${name}-error`)} className="text-xs text-destructive">{fieldErrors[name]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Honeypot — hidden from people, filled in by bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor={id('website')}>Website</label>
        <input id={id('website')} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id('name')}>Full Name *</Label>
          <Input id={id('name')} name="name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Your name"
            aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? id('name-error') : undefined} />
          {fieldError('name')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id('phone')}>Phone Number *</Label>
          <Input id={id('phone')} name="phone" required placeholder="+91 98XXX XXXXX" type="tel" autoComplete="tel" inputMode="tel"
            aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? id('phone-error') : undefined} />
          {fieldError('phone')}
        </div>
      </div>
      {!compact && (
        <div className="space-y-1.5">
          <Label htmlFor={id('email')}>Email (optional)</Label>
          <Input id={id('email')} name="email" type="email" autoComplete="email" placeholder="your@email.com" aria-invalid={!!fieldErrors.email} />
          {fieldError('email')}
        </div>
      )}
      {showInterest && (
        <div className="space-y-1.5">
          <Label htmlFor={id('interest')}>I am looking to</Label>
          <select id={id('interest')} name="interest" defaultValue={leadType}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="buy">Buy a property</option>
            <option value="rent">Rent a property</option>
            <option value="sell">Sell or rent out my property</option>
            <option value="general">Something else</option>
          </select>
        </div>
      )}
      {mode === 'visit' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={id('preferred_date')}>Preferred date *</Label>
            <Input id={id('preferred_date')} name="preferred_date" type="date" required min={todayISO()} max={todayISO(60)}
              aria-invalid={!!fieldErrors.preferred_date} />
            {fieldError('preferred_date')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id('preferred_slot')}>Preferred time</Label>
            <select id={id('preferred_slot')} name="preferred_slot" defaultValue=""
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Any time</option>
              <option value="morning">Morning (9 – 12)</option>
              <option value="afternoon">Afternoon (12 – 4)</option>
              <option value="evening">Evening (4 – 7)</option>
            </select>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={id('message')}>Message</Label>
        <Textarea
          id={id('message')}
          name="message"
          maxLength={2000}
          placeholder={propertyTitle ? `I'm interested in ${propertyTitle}. Please contact me.` : 'Tell us what you’re looking for…'}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Checkbox id={id('consent')} checked={consent} onCheckedChange={(v) => setConsent(v === true)} aria-invalid={!!fieldErrors.consent_contact} />
          <Label htmlFor={id('consent')} className="text-xs font-normal leading-relaxed text-muted-foreground">
            I agree to be contacted by Jalaram Real Estate about this enquiry, as described in the{' '}
            <a href="/privacy-policy" className="underline" target="_blank">privacy policy</a>. *
          </Label>
        </div>
        {fieldError('consent_contact')}
        <div className="flex items-start gap-2">
          <Checkbox id={id('marketing')} checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} />
          <Label htmlFor={id('marketing')} className="text-xs font-normal leading-relaxed text-muted-foreground">
            Send me updates about new listings (optional — you can opt out anytime).
          </Label>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
      <Button type="submit" disabled={loading} className="w-full gap-2 bg-primary">
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
        ) : mode === 'visit' ? (
          <><CalendarCheck className="h-4 w-4" /> {submitLabel ?? 'Request Site Visit'}</>
        ) : (
          <><Send className="h-4 w-4" /> {submitLabel ?? 'Submit Enquiry'}</>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Your details go to the Jalaram team, who coordinate with the owner and arrange visits.
        {phoneHref && <> Or call <a href={phoneHref} className="font-medium text-primary">{settings.business_phone}</a>.</>}
      </p>
    </form>
  );
}
