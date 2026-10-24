'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Images, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { PropertyImage } from '@/lib/types';

export function PropertyGallery({ images, title }: { images: PropertyImage[]; title: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const open = (i: number) => setIndex(i);
  const go = (delta: number) => setIndex((i) => (i === null ? null : (i + delta + images.length) % images.length));

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/7] items-center justify-center rounded-xl bg-muted">
        <MapPin className="h-10 w-10 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <button type="button" onClick={() => open(0)} className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted lg:row-span-2" aria-label="Open photo 1">
          <Image src={images[0].url} alt={images[0].alt || title} fill priority sizes="(max-width: 1024px) 100vw, 66vw" className="object-cover" />
        </button>
        {images.slice(1, 3).map((img, i) => (
          <button key={img.id} type="button" onClick={() => open(i + 1)} className="relative hidden aspect-[16/10] overflow-hidden rounded-xl bg-muted lg:block" aria-label={`Open photo ${i + 2}`}>
            <Image src={img.url} alt={`${title} — photo ${i + 2}`} fill sizes="33vw" className="object-cover" />
            {i === 1 && images.length > 3 && (
              <span className="absolute inset-0 flex items-center justify-center bg-primary/60 text-lg font-semibold text-primary-foreground">
                +{images.length - 3} more
              </span>
            )}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => open(0)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-accent">
        <Images className="h-4 w-4" /> View all {images.length} photo{images.length === 1 ? '' : 's'}
      </button>

      <Dialog open={index !== null} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent className="max-w-5xl border-0 bg-black p-0 sm:rounded-xl" onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}>
          <DialogTitle className="sr-only">{title} photos</DialogTitle>
          {index !== null && (
            <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
              <Image src={images[index].url} alt={`${title} — photo ${index + 1}`} fill sizes="100vw" className="object-contain" />
              {images.length > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70" aria-label="Previous photo">
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70" aria-label="Next photo">
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                {index + 1} / {images.length}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
