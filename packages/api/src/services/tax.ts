import { calculateLineTax, type PricingMode, type TaxJurisdiction } from '@cleanops/shared';
import { query } from '../lib/db.js';
import type { DbExecutor } from '../lib/db.js';
import { AppError } from '../lib/errors.js';

export interface TaxCalculationInput {
  businessId: string;
  countryCode?: string | null;
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
  const result = await query<TaxJurisdiction>(
    `SELECT id, country_code, name, tax_name, rate_bps, inclusive_label, exclusive_label, active
       FROM tax_jurisdictions
      WHERE active = true
      ORDER BY name`,
    [],
    executor
  );
  return result.rows;
}

export async function calculateTaxForBusiness(input: TaxCalculationInput): Promise<TaxCalculationResult> {
  const business = await query<{ pricing_mode: PricingMode; country_code: string }>(
    'SELECT pricing_mode, country_code FROM businesses WHERE id = $1',
    [input.businessId],
    input.executor
  );
  const businessRow = business.rows[0];
  if (!businessRow) throw new AppError(404, 'Business not found', 'BUSINESS_NOT_FOUND');
  const pricingMode = input.pricingMode ?? businessRow.pricing_mode;
  const countryCode = input.countryCode ?? businessRow.country_code;
  const jurisdictionResult = await query<TaxJurisdiction>(
    `SELECT id, country_code, name, tax_name, rate_bps, inclusive_label, exclusive_label, active
       FROM tax_jurisdictions
      WHERE country_code = $1 AND active = true`,
    [countryCode],
    input.executor
  );
  const jurisdiction = jurisdictionResult.rows[0];
  if (!jurisdiction) throw new AppError(400, 'Active tax jurisdiction not found for business country', 'TAX_JURISDICTION_NOT_FOUND');
  const totals = calculateLineTax(input.subtotalCents, jurisdiction.rate_bps / 10_000, pricingMode);
  return { jurisdiction, pricingMode, ...totals };
}
