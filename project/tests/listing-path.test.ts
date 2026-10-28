import { describe, expect, it } from 'vitest';
import { listingHeading, listingPath, parseListingSlug } from '@/lib/listing-path';

describe('listingPath', () => {
  it('builds clean search URLs', () => {
    expect(listingPath('rent', { locality: 'shilaj', bhk: '3', type: 'apartment' })).toBe('/3-bhk-flats-for-rent-in-shilaj-ahmedabad');
    expect(listingPath('sale', { locality: 'vastral' })).toBe('/properties-for-sale-in-vastral-ahmedabad');
    expect(listingPath('rent', { bhk: '2' })).toBe('/2-bhk-properties-for-rent-in-ahmedabad');
    expect(listingPath('sale', { locality: 'prahlad-nagar', type: 'villa' })).toBe('/villas-for-sale-in-prahlad-nagar-ahmedabad');
  });

  it('falls back to /buy and /rent, and ignores BHK for plots and junk values', () => {
    expect(listingPath('sale', {})).toBe('/buy');
    expect(listingPath('rent', { locality: '', bhk: '' })).toBe('/rent');
    expect(listingPath('sale', { type: 'plot', bhk: '3' })).toBe('/plots-for-sale-in-ahmedabad');
    expect(listingPath('sale', { bhk: '9', type: 'castle', locality: '../etc' })).toBe('/buy');
  });
});

describe('parseListingSlug', () => {
  it('round-trips every URL it builds', () => {
    const cases = [
      { purpose: 'rent' as const, locality: 'shilaj', bhk: '3', type: 'apartment' },
      { purpose: 'sale' as const, locality: 'south-bopal', type: 'independent_house' },
      { purpose: 'sale' as const, bhk: '5' },
      { purpose: 'rent' as const, locality: 'navrangpura' },
    ];
    for (const c of cases) {
      const slug = listingPath(c.purpose, c).slice(1);
      expect(parseListingSlug(slug)).toEqual({ purpose: c.purpose, locality: c.locality, bhk: c.bhk, type: c.type });
    }
  });

  it('rejects anything that is not a canonical search URL', () => {
    for (const slug of ['about', 'properties-for-rent-in-ahmedabad', '3-bhk-plots-for-sale-in-ahmedabad', '9-bhk-flats-for-rent-in-ahmedabad', 'flats-for-lease-in-ahmedabad', 'flats-for-rent-in-Shilaj-ahmedabad', 'flats-for-rent-in-shilaj']) {
      expect(parseListingSlug(slug)).toBeNull();
    }
  });
});

describe('listingHeading', () => {
  it('reads naturally', () => {
    expect(listingHeading('rent', { bhk: '3', type: 'apartment' }, 'Shilaj')).toBe('3 BHK Flats for Rent in Shilaj, Ahmedabad');
    expect(listingHeading('sale', { bhk: '5' })).toBe('5+ BHK Properties for Sale in Ahmedabad');
  });
});
