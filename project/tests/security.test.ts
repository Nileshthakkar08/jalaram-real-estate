import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/lib/safe-redirect';
import { qs } from '@/lib/api';
import { whatsappLink, callLink } from '@/lib/business';

describe('safeRedirect', () => {
  it('allows same-site relative paths', () => {
    expect(safeRedirect('/dashboard/properties/new', '/x')).toBe('/dashboard/properties/new');
  });

  it('rejects open-redirect attempts', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', null]) {
      expect(safeRedirect(bad as string, '/fallback')).toBe('/fallback');
    }
  });
});

describe('qs', () => {
  it('drops empty values and encodes the rest', () => {
    expect(qs({ a: 'x y', b: '', c: null, d: 0, e: undefined })).toBe('?a=x+y&d=0');
    expect(qs({})).toBe('');
  });
});

describe('contact links come only from configured settings', () => {
  it('returns null when nothing is configured', () => {
    expect(whatsappLink({}, 'hi')).toBeNull();
    expect(callLink({})).toBeNull();
  });

  it('builds links from settings', () => {
    expect(whatsappLink({ business_whatsapp: '91 98000 00000' }, 'Hi there')).toBe('https://wa.me/919800000000?text=Hi%20there');
    expect(callLink({ business_phone: '+91 79 1234 5678' })).toBe('tel:+917912345678');
  });
});
