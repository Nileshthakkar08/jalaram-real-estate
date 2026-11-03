import { describe, expect, it } from 'vitest';
import { areaInUnit, formatArea, formatAreaShort, propertyTypeLabel } from '@/lib/format';

describe('land areas', () => {
  it('converts square feet back to the unit the owner entered', () => {
    expect(areaInUnit(1305, 'sqyd')).toBe(145); // 145 var
    expect(areaInUnit(435600, 'acre')).toBe(10);
    expect(areaInUnit(1310, 'sqyd')).toBe(145.56);
    expect(areaInUnit(1200, null)).toBe(1200);
  });

  it('shows the owner unit with square feet alongside', () => {
    expect(formatArea(1305, 'sqyd')).toBe('145 var (1,305 sq ft)');
    expect(formatArea(435600, 'acre')).toBe('10 acres (4,35,600 sq ft)');
    expect(formatArea(1200, 'sqft')).toBe('1,200 sq ft');
    expect(formatAreaShort(1305, 'sqyd')).toBe('145 var');
  });

  it('labels land by its kind', () => {
    expect(propertyTypeLabel('plot', 'agricultural')).toBe('Agricultural land');
    expect(propertyTypeLabel('plot')).toBe('Plot / Land');
    expect(propertyTypeLabel('villa', 'agricultural')).toBe('Villa');
  });
});
