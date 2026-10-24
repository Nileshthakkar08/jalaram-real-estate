import type { PublicSettings } from '@/lib/types';

/**
 * Business identity. Contact details are NOT hardcoded: they come from admin-managed
 * settings (`/admin/settings`) and every UI element hides itself when a value is empty.
 */
export const BUSINESS = {
  name: 'Jalaram Real Estate',
  tagline: 'Find Your Property. Move with Confidence.',
  area: 'Ahmedabad, Gujarat, India',
  city: 'Ahmedabad',
};

export function whatsappLink(settings: PublicSettings, message: string): string | null {
  const number = settings.business_whatsapp?.replace(/\D/g, '');
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

export function callLink(settings: PublicSettings): string | null {
  const phone = settings.business_phone?.replace(/[^\d+]/g, '');
  return phone ? `tel:${phone}` : null;
}
