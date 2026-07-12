import { calculateLineTax, type PricingMode, type TaxJurisdiction } from '@cleanops/shared';
import { query } from '../lib/db.js';
import type { DbExecutor } from '../lib/db.js';

export interface TaxCalculationInput {
  businessId: string;
  jurisdictionCode?: string | null;
  pricingMode?: PricingMode | null;
  subtotalCents: number;
  executor?: DbExecutor;
}

export interface TaxCalculationResult {
  jurisdiction: TaxJurisdiction;
  pricingMode: PricingMode;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export async function getTaxJurisdictions(executor?: DbExecutor): Promise<TaxJurisdiction[]> {
  const result = await query<TaxJurisdiction & { code: string }>(
    `SELECT code, name, rate, currency FROM tax_jurisdictions WHERE active = true ORDER BY name`,
    [],
    executor
  );
  return result.rows;
}

export async function calculateTaxForBusiness(input: TaxCalculationInput): Promise<TaxCalculationResult> {
  const business = await query<{ pricing_mode: PricingMode; jurisdiction_code: string | null }>(
    'SELECT pricing_mode, jurisdiction_code FROM businesses WHERE id = $1',
    [input.businessId],
    input.executor
  );
  const pricingMode = input.pricingMode ?? business.rows[0]?.pricing_mode ?? 'tax_exclusive';
  const jurisdictionCode = input.jurisdictionCode ?? business.rows[0]?.jurisdiction_code ?? 'NZ';
  const jurisdictionResult = await query<TaxJurisdiction>(
    'SELECT code, name, rate, currency FROM tax_jurisdictions WHERE code = $1 AND active = true',
    [jurisdictionCode],
    input.executor
  );
  const jurisdiction = jurisdictionResult.rows[0] ?? { code: jurisdictionCode, name: jurisdictionCode, rate: 0, currency: 'NZD' };
  const totals = calculateLineTax(input.subtotalCents, jurisdiction.rate, pricingMode);
  return { jurisdiction, pricingMode, ...totals };
}
