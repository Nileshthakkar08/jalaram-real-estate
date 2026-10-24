import { describe, expect, it } from 'vitest';
import { formatMoney, formatPrice, formatPriceShort, listingPrice, leadStatusBadge, agreementStatusBadge, humanize } from '@/lib/format';

describe('price formatting', () => {
  it('formats INR with Indian grouping', () => {
    expect(formatPrice(5000000)).toBe('₹50,00,000');
    expect(formatPrice('12000.00', 'rent')).toBe('₹12,000/mo');
  });

  it('shortens lakhs and crores without trailing zeros', () => {
    expect(formatPriceShort(5000000)).toBe('₹50 L');
    expect(formatPriceShort('24500000.00')).toBe('₹2.45 Cr');
    expect(formatPriceShort(12000)).toBe('₹12,000');
    expect(listingPrice(12000, 'rent')).toBe('₹12,000/mo');
  });

  it('formats financial amounts exactly, with paise', () => {
    expect(formatMoney('4000.50')).toBe('₹4,000.50');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney('0.00')).toBe('₹0.00');
  });
});

describe('labels', () => {
  it('maps statuses to readable labels', () => {
    expect(leadStatusBadge('site_visit').label).toBe('Site Visit');
    expect(agreementStatusBadge('partially_paid').label).toBe('Partially Paid');
    expect(humanize('semi_furnished')).toBe('Semi furnished');
  });
});
