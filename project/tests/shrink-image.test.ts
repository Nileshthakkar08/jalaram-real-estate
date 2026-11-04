import { describe, expect, it } from 'vitest';
import { shrinkSize } from '@/lib/shrink-image';

describe('shrinkSize', () => {
  it('leaves photos at or under 2000px alone', () => {
    expect(shrinkSize(2000, 1500)).toBeNull();
    expect(shrinkSize(800, 600)).toBeNull();
  });

  it('scales the longest edge to 2000px and keeps the shape', () => {
    expect(shrinkSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(shrinkSize(3024, 4032)).toEqual({ width: 1500, height: 2000 });
  });
});
