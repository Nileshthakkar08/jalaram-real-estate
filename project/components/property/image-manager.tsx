'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';
import type { PropertyImage } from '@/lib/types';

const MAX_IMAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ImageManagerProps {
  /** e.g. `/owner/properties/12` or `/admin/properties/12` */
  basePath: string;
  images: PropertyImage[];
  onChange: (images: PropertyImage[], meta?: { resubmitted_for_review?: boolean }) => void;
  disabled?: boolean;
}

export function ImageManager({ basePath, images, onChange, disabled }: ImageManagerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remaining = MAX_IMAGES - images.length;

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files);
    const problems: string[] = [];
    list.forEach((f) => {
      if (!TYPES.includes(f.type)) problems.push(`${f.name}: use JPEG, PNG or WebP.`);
      else if (f.size > MAX_BYTES) problems.push(`${f.name}: larger than 5 MB.`);
    });
    if (list.length > remaining) problems.push(`You can add ${remaining} more photo${remaining === 1 ? '' : 's'} (maximum ${MAX_IMAGES}).`);
    if (problems.length) {
      setError(problems.join(' '));
      if (input.current) input.current.value = '';
      return;
    }

    const fd = new FormData();
    list.forEach((f) => fd.append('images[]', f));
    setBusy('upload');
    try {
      const res = await api.post<{ data: PropertyImage[]; meta?: { resubmitted_for_review?: boolean } }>(`${basePath}/images`, fd);
      onChange(res.data, res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  const move = async (index: number, delta: number) => {
    const order = images.map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setBusy('order');
    setError(null);
    try {
      const res = await api.put<{ data: PropertyImage[] }>(`${basePath}/images/order`, { image_ids: order });
      onChange(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const makeCover = (index: number) => move(index, -index);

  const remove = async (image: PropertyImage) => {
    if (!window.confirm('Delete this photo?')) return;
    setBusy(`delete-${image.id}`);
    setError(null);
    try {
      const res = await api.delete<{ data: PropertyImage[]; meta?: { resubmitted_for_review?: boolean } }>(`${basePath}/images/${image.id}`);
      onChange(res.data, res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {images.length} of {MAX_IMAGES} photos · JPEG, PNG or WebP up to 5 MB each. The first photo is the cover.
          Location data is removed from photos automatically.
        </p>
        <input ref={input} type="file" accept={TYPES.join(',')} multiple className="hidden" onChange={(e) => upload(e.target.files)} aria-label="Choose photos" />
        <Button type="button" onClick={() => input.current?.click()} disabled={disabled || remaining <= 0 || !!busy} className="gap-2">
          {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Add photos
        </Button>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-muted-foreground hover:border-accent"
        >
          <ImagePlus className="h-8 w-8" />
          <span className="mt-2 text-sm">Add at least one photo before submitting for review</span>
        </button>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-[4/3] bg-muted">
                <Image src={img.url} alt={img.alt || `Photo ${i + 1}`} fill sizes="33vw" className="object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Cover</span>}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <span className="text-xs text-muted-foreground">Photo {i + 1}</span>
                <div className="flex gap-1">
                  {i > 0 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={disabled || !!busy} onClick={() => makeCover(i)} aria-label={`Make photo ${i + 1} the cover`}>
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={disabled || !!busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move photo ${i + 1} earlier`}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={disabled || !!busy || i === images.length - 1} onClick={() => move(i, 1)} aria-label={`Move photo ${i + 1} later`}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={disabled || !!busy} onClick={() => remove(img)} aria-label={`Delete photo ${i + 1}`}>
                    {busy === `delete-${img.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
