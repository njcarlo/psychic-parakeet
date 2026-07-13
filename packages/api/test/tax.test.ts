import { describe, expect, it } from 'vitest';
import { calculateLineTax } from '@cleanops/shared';

describe('calculateLineTax', () => {
  it('calculates tax-exclusive totals', () => {
    expect(calculateLineTax(10_000, 0.15, 'exclusive')).toEqual({ subtotalCents: 10_000, taxCents: 1_500, totalCents: 11_500 });
  });

  it('backs tax out of tax-inclusive totals', () => {
    expect(calculateLineTax(11_500, 0.15, 'inclusive')).toEqual({ subtotalCents: 10_000, taxCents: 1_500, totalCents: 11_500 });
  });
});
