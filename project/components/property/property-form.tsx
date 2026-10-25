'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Field, selectClass } from '@/components/shared/form-field';
import { Section } from '@/components/shared/section';
import { api, ApiError, errorMessage } from '@/lib/api';
import { FACING_OPTIONS, FURNISHING_TYPES, PROPERTY_TYPES, formatPrice, humanize } from '@/lib/format';
import type { Amenity, Locality, ManagedProperty } from '@/lib/types';

interface PropertyFormProps {
  initial?: ManagedProperty;
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  /** Shows the internal moderation note field (staff only). */
  staff?: boolean;
}

const OTHER = 'other';

const numberOrNull = (v: FormDataEntryValue | null) => (v === null || v === '' ? null : Number(v));
const textOrNull = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === '' ? null : String(v).trim());

export function PropertyForm({ initial, submitLabel, onSubmit, staff }: PropertyFormProps) {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<number[]>(initial?.amenity_ids ?? []);
  const [purpose, setPurpose] = useState(initial?.listing_purpose ?? 'sale');
  const [type, setType] = useState(initial?.property_type ?? 'apartment');
  const [price, setPrice] = useState(initial?.price ? String(Number(initial.price)) : '');
  const [negotiable, setNegotiable] = useState(initial?.price_negotiable ?? false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // '' = not chosen, a locality id, or OTHER to type a name that isn't in the list.
  const [localityChoice, setLocalityChoice] = useState('');
  const [localityName, setLocalityName] = useState('');
  const initialLocalityName = initial?.locality?.name;

  useEffect(() => {
    Promise.all([api.get<{ data: Locality[] }>('/localities'), api.get<{ data: Amenity[] }>('/amenities')])
      .then(([l, a]) => {
        setLocalities(l.data);
        setAmenities(a.data);
        // A typed-in locality stays inactive (not in the list) until an admin activates it.
        if (initial?.locality_id && l.data.some((x) => x.id === initial.locality_id)) {
          setLocalityChoice(String(initial.locality_id));
        } else if (initialLocalityName) {
          setLocalityChoice(OTHER);
          setLocalityName(initialLocalityName);
        }
      })
      .catch((e) => setLoadError(errorMessage(e)));
  }, [initial?.locality_id, initialLocalityName]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      title: String(fd.get('title') ?? '').trim(),
      description: String(fd.get('description') ?? '').trim(),
      listing_purpose: purpose,
      property_type: type,
      locality_id: localityChoice && localityChoice !== OTHER ? Number(localityChoice) : null,
      locality_name: localityChoice === OTHER ? localityName.trim() || null : null,
      public_address: String(fd.get('public_address') ?? '').trim(),
      private_address: textOrNull(fd.get('private_address')),
      pincode: textOrNull(fd.get('pincode')),
      price: numberOrNull(fd.get('price')),
      security_deposit: purpose === 'rent' ? numberOrNull(fd.get('security_deposit')) : null,
      maintenance_charges: numberOrNull(fd.get('maintenance_charges')),
      price_negotiable: negotiable,
      area_sqft: numberOrNull(fd.get('area_sqft')),
      bedrooms: numberOrNull(fd.get('bedrooms')),
      bathrooms: numberOrNull(fd.get('bathrooms')),
      balconies: numberOrNull(fd.get('balconies')),
      floor_number: numberOrNull(fd.get('floor_number')),
      total_floors: numberOrNull(fd.get('total_floors')),
      furnishing: textOrNull(fd.get('furnishing')),
      facing: textOrNull(fd.get('facing')),
      property_age_years: numberOrNull(fd.get('property_age_years')),
      available_from: textOrNull(fd.get('available_from')),
      owner_contact_name: textOrNull(fd.get('owner_contact_name')),
      owner_contact_phone: textOrNull(fd.get('owner_contact_phone')),
      owner_contact_email: textOrNull(fd.get('owner_contact_email')),
      amenity_ids: selectedAmenities,
    };
    if (staff) payload.moderation_note = textOrNull(fd.get('moderation_note'));

    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await onSubmit(payload);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
        setError('Please correct the highlighted fields.');
        document.getElementById('property-form-top')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleAmenity = (id: number, on: boolean) =>
    setSelectedAmenities((prev) => (on ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div id="property-form-top" />
      {loadError && <p className="text-sm text-destructive" role="alert">Could not load localities/amenities: {loadError}</p>}
      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p>}

      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Listing for *" htmlFor="listing_purpose">
            <select id="listing_purpose" className={selectClass} value={purpose} onChange={(e) => setPurpose(e.target.value as 'sale' | 'rent')}>
              <option value="sale">Sale</option>
              <option value="rent">Rent</option>
            </select>
          </Field>
          <Field label="Property type *" htmlFor="property_type">
            <select id="property_type" className={selectClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Title *" htmlFor="title" error={errors.title} hint="e.g. 3 BHK apartment near Judges Bungalow Road" className="sm:col-span-2">
            <Input id="title" name="title" defaultValue={initial?.title} required minLength={10} maxLength={160} />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description} hint="At least 30 characters are needed before submitting for review." className="sm:col-span-2">
            <Textarea id="description" name="description" defaultValue={initial?.description} rows={6} maxLength={5000} />
          </Field>
        </div>
      </Section>

      <Section title="Location">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Locality *" htmlFor="locality_id" error={localityChoice === OTHER ? undefined : errors.locality_id}>
            <select id="locality_id" className={selectClass} value={localityChoice} onChange={(e) => setLocalityChoice(e.target.value)}>
              <option value="">Select locality</option>
              {localities.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              <option value={OTHER}>Other (type the area name)</option>
            </select>
          </Field>
          {localityChoice === OTHER && (
            <Field
              label="Area name *"
              htmlFor="locality_name"
              error={errors.locality_name ?? errors.locality_id}
              hint="e.g. Shilaj. Jalaram reviews new areas before they appear in search filters."
            >
              <Input id="locality_name" value={localityName} onChange={(e) => setLocalityName(e.target.value)} maxLength={80} autoFocus={!initial} />
            </Field>
          )}
          <Field label="Pincode" htmlFor="pincode" error={errors.pincode}>
            <Input id="pincode" name="pincode" defaultValue={initial?.pincode ?? ''} inputMode="numeric" maxLength={6} />
          </Field>
          <Field label="Public location *" htmlFor="public_address" error={errors.public_address} hint="Shown on the website. Use a landmark or road, not your flat number." className="sm:col-span-2">
            <Input id="public_address" name="public_address" defaultValue={initial?.public_address} maxLength={200} />
          </Field>
          <Field label="Full address (private)" htmlFor="private_address" error={errors.private_address} hint="Only visible to the Jalaram team for arranging visits." className="sm:col-span-2">
            <Input id="private_address" name="private_address" defaultValue={initial?.private_address ?? ''} maxLength={300} />
          </Field>
        </div>
      </Section>

      <Section title="Price">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={purpose === 'rent' ? 'Monthly rent (₹) *' : 'Asking price (₹) *'} htmlFor="price" error={errors.price} hint={price ? formatPrice(price, purpose) : undefined}>
            <Input id="price" name="price" type="number" min={1000} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
          </Field>
          {purpose === 'rent' && (
            <Field label="Security deposit (₹)" htmlFor="security_deposit" error={errors.security_deposit}>
              <Input id="security_deposit" name="security_deposit" type="number" min={0} defaultValue={initial?.security_deposit ? Number(initial.security_deposit) : ''} />
            </Field>
          )}
          <Field label="Maintenance per month (₹)" htmlFor="maintenance_charges" error={errors.maintenance_charges}>
            <Input id="maintenance_charges" name="maintenance_charges" type="number" min={0} defaultValue={initial?.maintenance_charges ? Number(initial.maintenance_charges) : ''} />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Checkbox id="price_negotiable" checked={negotiable} onCheckedChange={(v) => setNegotiable(v === true)} />
          <Label htmlFor="price_negotiable" className="font-normal">Price is negotiable</Label>
        </div>
      </Section>

      <Section title="Details">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Area (sq ft) *" htmlFor="area_sqft" error={errors.area_sqft}>
            <Input id="area_sqft" name="area_sqft" type="number" min={50} defaultValue={initial?.area_sqft ?? ''} />
          </Field>
          <Field label={type === 'plot' ? 'Bedrooms' : 'Bedrooms (BHK) *'} htmlFor="bedrooms" error={errors.bedrooms}>
            <Input id="bedrooms" name="bedrooms" type="number" min={0} max={20} defaultValue={initial?.bedrooms ?? ''} />
          </Field>
          <Field label="Bathrooms" htmlFor="bathrooms" error={errors.bathrooms}>
            <Input id="bathrooms" name="bathrooms" type="number" min={0} max={20} defaultValue={initial?.bathrooms ?? ''} />
          </Field>
          <Field label="Balconies" htmlFor="balconies" error={errors.balconies}>
            <Input id="balconies" name="balconies" type="number" min={0} max={20} defaultValue={initial?.balconies ?? ''} />
          </Field>
          <Field label="Floor" htmlFor="floor_number" error={errors.floor_number}>
            <Input id="floor_number" name="floor_number" type="number" min={-3} max={200} defaultValue={initial?.floor_number ?? ''} />
          </Field>
          <Field label="Total floors" htmlFor="total_floors" error={errors.total_floors}>
            <Input id="total_floors" name="total_floors" type="number" min={1} max={200} defaultValue={initial?.total_floors ?? ''} />
          </Field>
          <Field label="Furnishing" htmlFor="furnishing" error={errors.furnishing}>
            <select id="furnishing" name="furnishing" className={selectClass} defaultValue={initial?.furnishing ?? ''}>
              <option value="">Not specified</option>
              {FURNISHING_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Facing" htmlFor="facing" error={errors.facing}>
            <select id="facing" name="facing" className={selectClass} defaultValue={initial?.facing ?? ''}>
              <option value="">Not specified</option>
              {FACING_OPTIONS.map((f) => <option key={f} value={f}>{humanize(f)}</option>)}
            </select>
          </Field>
          <Field label="Property age (years)" htmlFor="property_age_years" error={errors.property_age_years}>
            <Input id="property_age_years" name="property_age_years" type="number" min={0} max={150} defaultValue={initial?.property_age_years ?? ''} />
          </Field>
          <Field label="Available from" htmlFor="available_from" error={errors.available_from}>
            <Input id="available_from" name="available_from" type="date" defaultValue={initial?.available_from ?? ''} />
          </Field>
        </div>
      </Section>

      <Section title="Amenities">
        {amenities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No amenities configured.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                <Checkbox checked={selectedAmenities.includes(a.id)} onCheckedChange={(v) => toggleAmenity(a.id, v === true)} />
                {a.name}
              </label>
            ))}
          </div>
        )}
      </Section>

      <Section title="Contact for visits (private)">
        <p className="mb-4 text-sm text-muted-foreground">
          Leave blank to use your account details. These are only visible to the Jalaram team — customers always contact Jalaram, never you directly.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Contact name" htmlFor="owner_contact_name" error={errors.owner_contact_name}>
            <Input id="owner_contact_name" name="owner_contact_name" defaultValue={initial?.owner_contact_name ?? ''} />
          </Field>
          <Field label="Contact phone" htmlFor="owner_contact_phone" error={errors.owner_contact_phone}>
            <Input id="owner_contact_phone" name="owner_contact_phone" type="tel" defaultValue={initial?.owner_contact_phone ?? ''} />
          </Field>
          <Field label="Contact email" htmlFor="owner_contact_email" error={errors.owner_contact_email}>
            <Input id="owner_contact_email" name="owner_contact_email" type="email" defaultValue={initial?.owner_contact_email ?? ''} />
          </Field>
        </div>
      </Section>

      {staff && (
        <Section title="Internal moderation note">
          <Textarea name="moderation_note" defaultValue={initial?.moderation_note ?? ''} rows={3} placeholder="Visible to staff only" />
        </Section>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {submitLabel}
        </Button>
      </div>
    </form>
  );
}
