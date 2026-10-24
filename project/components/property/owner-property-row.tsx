import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate, listingPrice, listingStatusLabels } from '@/lib/format';
import type { ManagedProperty } from '@/lib/types';

export function OwnerPropertyRow({ property, href, extra }: { property: ManagedProperty; href?: string; extra?: ReactNode }) {
  const badge = listingStatusLabels(property.status);
  return (
    <li>
      <Link href={href ?? `/dashboard/properties/${property.id}`} className="flex items-center gap-4 py-3 hover:bg-muted/50 sm:px-2">
        <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {property.cover_image ? (
            <Image src={property.cover_image.url} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <MapPin className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground/40" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{property.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {property.reference_code} · {property.locality?.name} · {listingPrice(property.price, property.listing_purpose)}
          </p>
          <p className="text-xs text-muted-foreground">Updated {formatDate(property.updated_at)}</p>
          {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
        </div>
        <StatusBadge {...badge} />
        <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </Link>
    </li>
  );
}
