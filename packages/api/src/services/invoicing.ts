import { query } from '../lib/db.js';
import type { PoolClient } from '../lib/db.js';
import { AppError } from '../lib/errors.js';
import { calculateTaxForBusiness } from './tax.js';

export interface InvoiceLineInput {
  job_id?: string | null;
  description: string;
  quantity: number;
  unit_price_cents: number;
  tax_cents: number;
  line_total_cents: number;
  sort_order: number;
}

export interface CreateInvoiceInput {
  businessId: string;
  clientId: string;
  jobIds: string[];
  dueAt?: Date | null;
  currency?: string;
}

export async function allocateInvoiceNumber(client: PoolClient, businessId: string): Promise<number> {
  const result = await query<{ next_invoice_number: number }>(
    'SELECT next_invoice_number FROM businesses WHERE id = $1 FOR UPDATE',
    [businessId],
    client
  );
  const nextNumber = result.rows[0]?.next_invoice_number;
  if (!nextNumber) throw new AppError(404, 'Business not found', 'BUSINESS_NOT_FOUND');
  await query('UPDATE businesses SET next_invoice_number = next_invoice_number + 1 WHERE id = $1', [businessId], client);
  return nextNumber;
}

function formatInvoiceNumber(invoiceNumber: number): string {
  return `INV-${String(invoiceNumber).padStart(6, '0')}`;
}

export async function buildInvoiceLinesFromJobs(client: PoolClient, businessId: string, jobIds: string[]): Promise<InvoiceLineInput[]> {
  if (jobIds.length === 0) throw new AppError(400, 'At least one job is required', 'NO_JOBS');
  const result = await query<{
    id: string;
    scheduled_start: Date;
    property_name: string;
    price_cents: number | null;
  }>(
    `SELECT j.id, j.scheduled_start, p.label AS property_name, j.price_cents
       FROM jobs j JOIN properties p ON p.id = j.property_id
      WHERE j.business_id = $1 AND j.id = ANY($2::uuid[]) AND j.status = 'completed'
      ORDER BY j.scheduled_start`,
    [businessId, jobIds],
    client
  );
  if (result.rows.length !== jobIds.length) {
    throw new AppError(400, 'All jobs must exist and be completed', 'INVALID_INVOICE_JOBS');
  }
  return result.rows.map((job) => ({
    job_id: job.id,
    description: `Cleaning service - ${job.property_name} - ${new Date(job.scheduled_start).toISOString().slice(0, 10)}`,
    quantity: 1,
    unit_price_cents: job.price_cents ?? 0,
    tax_cents: 0,
    line_total_cents: job.price_cents ?? 0,
    sort_order: 0
  }));
}

export async function createInvoiceFromJobs(client: PoolClient, input: CreateInvoiceInput) {
  const business = await query<{
    currency: string;
    pricing_mode: 'inclusive' | 'exclusive';
    country_code: string;
    bir_permit_number: string | null;
    atp_number: string | null;
  }>(
    'SELECT currency, pricing_mode, country_code, bir_permit_number, atp_number FROM businesses WHERE id = $1',
    [input.businessId],
    client
  );
  const businessRow = business.rows[0];
  if (!businessRow) throw new AppError(404, 'Business not found', 'BUSINESS_NOT_FOUND');

  const rawLines = await buildInvoiceLinesFromJobs(client, input.businessId, input.jobIds);
  const lines: InvoiceLineInput[] = [];
  let subtotalCents = 0;
  let taxCents = 0;
  let totalCents = 0;
  let taxJurisdictionId: string | null = null;
  for (const [index, line] of rawLines.entries()) {
    const lineAmountCents = line.quantity * line.unit_price_cents;
    const tax = await calculateTaxForBusiness({
      businessId: input.businessId,
      countryCode: businessRow.country_code,
      pricingMode: businessRow.pricing_mode,
      subtotalCents: lineAmountCents,
      executor: client
    });
    taxJurisdictionId ??= tax.jurisdiction.id;
    subtotalCents += tax.subtotalCents;
    taxCents += tax.taxCents;
    totalCents += tax.totalCents;
    lines.push({
      ...line,
      tax_cents: tax.taxCents,
      line_total_cents: tax.totalCents,
      sort_order: index
    });
  }
  if (!taxJurisdictionId) throw new AppError(400, 'At least one invoice line is required', 'NO_INVOICE_LINES');
  const invoiceNumber = await allocateInvoiceNumber(client, input.businessId);

  const invoice = await query(
    `INSERT INTO invoices (
       business_id, client_id, invoice_number, invoice_number_display, status, currency,
       subtotal_cents, tax_cents, total_cents, pricing_mode, tax_jurisdiction_id,
       due_at, bir_permit_number, atp_number
     )
     VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      input.businessId,
      input.clientId,
      invoiceNumber,
      formatInvoiceNumber(invoiceNumber),
      input.currency ?? businessRow.currency,
      subtotalCents,
      taxCents,
      totalCents,
      businessRow.pricing_mode,
      taxJurisdictionId,
      input.dueAt ?? null,
      businessRow.bir_permit_number,
      businessRow.atp_number
    ],
    client
  );
  const invoiceId = invoice.rows[0].id;
  for (const line of lines) {
    await query(
      `INSERT INTO invoice_line_items (business_id, invoice_id, job_id, description, quantity, unit_price_cents, tax_cents, line_total_cents, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [input.businessId, invoiceId, line.job_id ?? null, line.description, line.quantity, line.unit_price_cents, line.tax_cents, line.line_total_cents, line.sort_order],
      client
    );
  }
  return invoice.rows[0];
}
