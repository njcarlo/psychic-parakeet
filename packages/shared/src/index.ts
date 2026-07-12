export type PricingMode = 'tax_inclusive' | 'tax_exclusive';

export interface TaxJurisdiction {
  code: string;
  name: string;
  rate: number;
  currency: string;
}

export interface TaxTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export function calculateLineTax(amountCents: number, rate: number, pricingMode: PricingMode): TaxTotals {
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    throw new Error('amountCents must be a non-negative number');
  }
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error('rate must be a non-negative number');
  }

  if (pricingMode === 'tax_inclusive') {
    const subtotalCents = Math.round(amountCents / (1 + rate));
    return {
      subtotalCents,
      taxCents: amountCents - subtotalCents,
      totalCents: amountCents
    };
  }

  const taxCents = Math.round(amountCents * rate);
  return {
    subtotalCents: amountCents,
    taxCents,
    totalCents: amountCents + taxCents
  };
}
