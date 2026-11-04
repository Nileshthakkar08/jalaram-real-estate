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
  founder: {
    name: 'Nilesh Thakkar',
    title: 'Founder',
    bio: 'A software engineer building a real estate business.',
  },
};

/**
 * schema.org description of the business for search engines (homepage). Contact details are
 * included only when set in admin settings, so nothing unverified is published.
 */
export function businessJsonLd(settings: PublicSettings, siteUrl: string) {
  const url = siteUrl.replace(/\/$/, '') + '/';
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${url}#business`,
    name: BUSINESS.name,
    url,
    logo: `${url}icon-512.png`,
    image: `${url}icon-512.png`,
    slogan: BUSINESS.tagline,
    areaServed: { '@type': 'City', name: 'Ahmedabad', containedInPlace: { '@type': 'State', name: 'Gujarat' } },
    founder: { '@type': 'Person', name: BUSINESS.founder.name, jobTitle: BUSINESS.founder.title, description: BUSINESS.founder.bio },
    ...(settings.business_phone ? { telephone: settings.business_phone } : {}),
    ...(settings.business_email ? { email: settings.business_email } : {}),
    ...(settings.business_address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: settings.business_address,
            addressLocality: 'Ahmedabad',
            addressRegion: 'Gujarat',
            addressCountry: 'IN',
          },
        }
      : {}),
  };
}

export function whatsappLink(settings: PublicSettings, message: string): string | null {
  const number = settings.business_whatsapp?.replace(/\D/g, '');
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

export function callLink(settings: PublicSettings): string | null {
  const phone = settings.business_phone?.replace(/[^\d+]/g, '');
  return phone ? `tel:${phone}` : null;
}
