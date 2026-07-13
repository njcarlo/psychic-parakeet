export * from './constants.js';
export * from './types.js';
export * from './tax.js';
export * from './haversine.js';

import type { PricingMode } from './types.js';
import { addGstExclusive, splitGstInclusive } from './tax.js';

/** Convenience wrapper: rate is a decimal (0.15 = 15%), pricingMode uses inclusive|exclusive. */
export interface TaxTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export function calculateLineTax(
  amountCents: number,
  rate: number,
  pricingMode: PricingMode | 'tax_inclusive' | 'tax_exclusive',
): TaxTotals {
  const rateBps = Math.round(rate * 10_000);
  const mode: PricingMode =
    pricingMode === 'tax_inclusive' || pricingMode === 'inclusive' ? 'inclusive' : 'exclusive';

  if (mode === 'inclusive') {
    const { netCents, taxCents } = splitGstInclusive(amountCents, rateBps);
    return { subtotalCents: netCents, taxCents, totalCents: amountCents };
  }

  const { grossCents, taxCents } = addGstExclusive(amountCents, rateBps);
  return { subtotalCents: amountCents, taxCents, totalCents: grossCents };
}
