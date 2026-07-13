import type { PricingMode } from './types.js';

export type { PricingMode } from './types.js';

export interface InclusiveTaxSplit {
  netCents: number;
  taxCents: number;
}

export interface ExclusiveTaxAddition {
  grossCents: number;
  taxCents: number;
}

export function splitGstInclusive(totalCents: number, rateBps: number): InclusiveTaxSplit {
  assertWholeCents(totalCents, 'totalCents');
  assertRateBps(rateBps);

  const taxCents = roundHalfUpBigInt(
    BigInt(totalCents) * BigInt(rateBps),
    BigInt(10_000 + rateBps),
  );

  return {
    netCents: totalCents - taxCents,
    taxCents,
  };
}

export function addGstExclusive(netCents: number, rateBps: number): ExclusiveTaxAddition {
  assertWholeCents(netCents, 'netCents');
  assertRateBps(rateBps);

  const taxCents = roundHalfUpBigInt(BigInt(netCents) * BigInt(rateBps), 10_000n);

  return {
    grossCents: netCents + taxCents,
    taxCents,
  };
}

export function isPricingMode(value: string): value is PricingMode {
  return value === 'inclusive' || value === 'exclusive';
}

export function isInclusivePricingMode(pricingMode: PricingMode): boolean {
  return pricingMode === 'inclusive';
}

export function isExclusivePricingMode(pricingMode: PricingMode): boolean {
  return pricingMode === 'exclusive';
}

function roundHalfUpBigInt(numerator: bigint, denominator: bigint): number {
  const rounded = (numerator * 2n + denominator) / (denominator * 2n);

  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Rounded cent amount exceeds Number.MAX_SAFE_INTEGER');
  }

  return Number(rounded);
}

function assertWholeCents(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer number of cents`);
  }
}

function assertRateBps(rateBps: number): void {
  if (!Number.isSafeInteger(rateBps) || rateBps < 0) {
    throw new RangeError('rateBps must be a non-negative safe integer');
  }
}
