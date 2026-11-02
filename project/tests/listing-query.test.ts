import { describe, expect, it } from 'vitest';
import { listingApiQuery, searchParamsSource } from '@/lib/listing-query';

describe('listingApiQuery', () => {
  it('produces the same query on the server (page searchParams) and in the browser (URLSearchParams)', () => {
    const server = listingApiQuery('rent', searchParamsSource({ bhk: '3', locality: 'shilaj', page: '2', utm_source: 'x' }));
    const browser = listingApiQuery('rent', new URLSearchParams('utm_source=x&page=2&locality=shilaj&bhk=3'));
    expect(server).toBe(browser);
    expect(server).toBe('purpose=rent&sort=newest&page=2&per_page=12&locality=shilaj&bhk=3');
  });

  it('pins the locality on area pages and ignores invalid page numbers', () => {
    const q = listingApiQuery('sale', new URLSearchParams('locality=gota&page=abc'), { locality: 'shilaj' });
    expect(q).toBe('purpose=sale&sort=newest&page=1&per_page=12&locality=shilaj');
  });

  it('takes the first value of repeated query params', () => {
    expect(searchParamsSource({ type: ['villa', 'plot'] }).get('type')).toBe('villa');
    expect(searchParamsSource({}).get('type')).toBeNull();
  });

  it('lists sale and rent together on the all-properties page', () => {
    const q = listingApiQuery('all', new URLSearchParams('bhk=2&purpose=sale'));
    expect(q).toBe('sort=newest&page=1&per_page=12&bhk=2');
  });
});
