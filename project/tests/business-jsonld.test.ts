import { describe, expect, it } from 'vitest';
import { businessJsonLd } from '@/lib/business';

describe('businessJsonLd', () => {
  it('names the founder and leaves out contact details that are not set', () => {
    const data = businessJsonLd({}, 'https://jalaramrealestate.in');
    expect(data['@type']).toBe('RealEstateAgent');
    expect(data.url).toBe('https://jalaramrealestate.in/');
    expect(data.founder.name).toBe('Nilesh Thakkar');
    expect(data).not.toHaveProperty('telephone');
    expect(data).not.toHaveProperty('address');
  });

  it('includes contact details from admin settings', () => {
    const data = businessJsonLd({ business_phone: '+91 98250 00000', business_address: 'Vastral, Ahmedabad' }, 'https://jalaramrealestate.in/');
    expect(data).toMatchObject({ telephone: '+91 98250 00000', address: { streetAddress: 'Vastral, Ahmedabad', addressCountry: 'IN' } });
  });
});
