'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Maximize, BedDouble, Bath, Share2 } from 'lucide-react';
import { listingPrice, propertyTypeLabel } from '@/lib/format';
import type { PublicProperty } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface PropertyCardProps {
  property: PublicProperty;
  className?: string;
}

export function PropertyCard({ property, className }: PropertyCardProps) {
  const imageUrl = property.cover_image?.url;

  const share = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/property/${property.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: property.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'The property link is on your clipboard.' });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast({ title: 'Could not share', description: url });
      }
    }
  };

  return (
    <Link
      href={`/property/${property.slug}`}
      className={cn(
        'group block overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/5',
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={property.cover_image?.alt || property.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <MapPin className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge className="bg-primary text-primary-foreground shadow-sm">
            {property.listing_purpose === 'sale' ? 'For Sale' : 'For Rent'}
          </Badge>
          {property.is_featured && (
            <Badge className="bg-accent text-accent-foreground shadow-sm">Featured</Badge>
          )}
        </div>
        <div className="absolute right-3 top-3 flex gap-1.5">
          <button
            type="button"
            onClick={share}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm transition-colors hover:bg-card"
            aria-label={`Share ${property.title}`}
          >
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary">
            {property.title}
          </h3>
          <span className="shrink-0 text-lg font-bold text-primary">
            {listingPrice(property.price, property.listing_purpose)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="truncate">{property.locality?.name ? `${property.locality.name} · ` : ''}{property.public_address}</span>
        </div>

        <div className="flex items-center gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
          {property.bedrooms !== null && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-4 w-4" />
              {property.bedrooms} BHK
            </span>
          )}
          {property.bathrooms !== null && (
            <span className="flex items-center gap-1">
              <Bath className="h-4 w-4" />
              {property.bathrooms}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Maximize className="h-4 w-4" />
            {property.area_sqft.toLocaleString('en-IN')} sq ft
          </span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {propertyTypeLabel(property.property_type)}
          </span>
          <span className="text-xs text-muted-foreground">{property.reference_code}</span>
        </div>
      </div>
    </Link>
  );
}
