export function formatPrice(price: number | string, listingType?: string): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(price));

  if (listingType === 'rent') {
    return `${formatted}/mo`;
  }
  return formatted;
}

/** Exact INR amount with paise, for financial records. */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

export function formatPriceShort(price: number | string): string {
  const value = Number(price);
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  }
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2).replace(/\.?0+$/, '')} L`;
  }
  return `₹${value.toLocaleString('en-IN')}`;
}

/** Card/list price: compact for sale, monthly for rent. */
export function listingPrice(price: number | string, purpose: string): string {
  return purpose === 'rent' ? `${formatPriceShort(price)}/mo` : formatPriceShort(price);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 0) return 'in the future';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Value for <input type="datetime-local"> in the browser's local time. */
export function toDateTimeLocal(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function propertyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    apartment: 'Apartment',
    independent_house: 'Independent House',
    villa: 'Villa',
    plot: 'Plot',
  };
  return labels[type] ?? type;
}

type Badge = { label: string; className: string };

export function listingStatusLabels(status: string): Badge {
  const map: Record<string, Badge> = {
    draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
    pending: { label: 'Pending Review', className: 'bg-amber-100 text-amber-800' },
    published: { label: 'Published', className: 'bg-green-100 text-green-800' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
    unavailable: { label: 'Unavailable', className: 'bg-slate-200 text-slate-700' },
    expired: { label: 'Expired', className: 'bg-orange-100 text-orange-800' },
    suspended: { label: 'Suspended', className: 'bg-orange-100 text-orange-800' },
    closed: { label: 'Closed', className: 'bg-gray-200 text-gray-700' },
  };
  return map[status] ?? { label: humanize(status), className: 'bg-muted text-muted-foreground' };
}

export function leadStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'New',
    assigned: 'Assigned',
    contacted: 'Contacted',
    qualified: 'Qualified',
    site_visit: 'Site Visit',
    negotiation: 'Negotiation',
    won: 'Won',
    lost: 'Lost',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? humanize(status);
}

export function leadStatusBadge(status: string): Badge {
  const map: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    assigned: 'bg-indigo-100 text-indigo-800',
    contacted: 'bg-sky-100 text-sky-800',
    qualified: 'bg-teal-100 text-teal-800',
    site_visit: 'bg-amber-100 text-amber-800',
    negotiation: 'bg-purple-100 text-purple-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-200 text-gray-700',
  };
  return { label: leadStatusLabel(status), className: map[status] ?? 'bg-muted text-muted-foreground' };
}

export function dealStatusBadge(status: string): Badge {
  const map: Record<string, Badge> = {
    negotiation: { label: 'Negotiation', className: 'bg-purple-100 text-purple-800' },
    agreement_pending: { label: 'Agreement Pending', className: 'bg-amber-100 text-amber-800' },
    closed_won: { label: 'Closed — Won', className: 'bg-green-100 text-green-800' },
    closed_lost: { label: 'Closed — Lost', className: 'bg-red-100 text-red-800' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-200 text-gray-700' },
  };
  return map[status] ?? { label: humanize(status), className: 'bg-muted text-muted-foreground' };
}

export function agreementStatusBadge(status: string): Badge {
  const map: Record<string, Badge> = {
    estimated: { label: 'Estimated', className: 'bg-muted text-muted-foreground' },
    agreed: { label: 'Agreed', className: 'bg-blue-100 text-blue-800' },
    due: { label: 'Due', className: 'bg-amber-100 text-amber-800' },
    partially_paid: { label: 'Partially Paid', className: 'bg-sky-100 text-sky-800' },
    paid: { label: 'Paid', className: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-200 text-gray-700' },
    waived: { label: 'Waived', className: 'bg-slate-200 text-slate-700' },
    refunded: { label: 'Refunded', className: 'bg-orange-100 text-orange-800' },
  };
  return map[status] ?? { label: humanize(status), className: 'bg-muted text-muted-foreground' };
}

export function visitStatusBadge(status: string): Badge {
  const map: Record<string, Badge> = {
    requested: { label: 'Requested', className: 'bg-blue-100 text-blue-800' },
    scheduled: { label: 'Scheduled', className: 'bg-amber-100 text-amber-800' },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-200 text-gray-700' },
    no_show: { label: 'No Show', className: 'bg-red-100 text-red-800' },
  };
  return map[status] ?? { label: humanize(status), className: 'bg-muted text-muted-foreground' };
}

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'independent_house', label: 'Independent House' },
  { value: 'villa', label: 'Villa' },
  { value: 'plot', label: 'Plot' },
];

export const FURNISHING_TYPES = [
  { value: 'unfurnished', label: 'Unfurnished' },
  { value: 'semi_furnished', label: 'Semi Furnished' },
  { value: 'fully_furnished', label: 'Fully Furnished' },
];

export const FACING_OPTIONS = ['north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west'];

export const SALE_BUDGETS = [
  { value: '0-5000000', label: 'Under ₹50 L' },
  { value: '5000000-10000000', label: '₹50 L – ₹1 Cr' },
  { value: '10000000-20000000', label: '₹1 – 2 Cr' },
  { value: '20000000-', label: 'Above ₹2 Cr' },
];

export const RENT_BUDGETS = [
  { value: '0-15000', label: 'Under ₹15,000' },
  { value: '15000-30000', label: '₹15,000 – 30,000' },
  { value: '30000-60000', label: '₹30,000 – 60,000' },
  { value: '60000-', label: 'Above ₹60,000' },
];
