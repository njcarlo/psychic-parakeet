import { query } from '../lib/db.js';
import type { PoolClient } from '../lib/db.js';
import { AppError } from '../lib/errors.js';
import { calculateTaxForBusiness } from './tax.js';

export interface InvoiceLineInput {
  job_id?: string | null;
  description: string;
  quantity: number;
  unit_amount_cents: number;
}

export interface CreateInvoiceInput {
  businessId: string;
  clientId: string;
  jobIds: string[];
  dueDate?: Date | null;
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

export async function buildInvoiceLinesFromJobs(client: PoolClient, businessId: string, jobIds: string[]): Promise<InvoiceLineInput[]> {
  if (jobIds.length === 0) throw new AppError(400, 'At least one job is required', 'NO_JOBS');
  const result = await query<{
    id: string;
    scheduled_start: Date;
    property_name: string;
    price_cents: number | null;
  }>(
    `SELECT j.id, j.scheduled_start, p.name AS property_name, j.price_cents
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
    unit_amount_cents: job.price_cents ?? 0
  }));
}

export async function createInvoiceFromJobs(client: PoolClient, input: CreateInvoiceInput) {
  const lines = await buildInvoiceLinesFromJobs(client, input.businessId, input.jobIds);
  const subtotalCents = lines.reduce((sum, line) => sum + line.quantity * line.unit_amount_cents, 0);
  const tax = await calculateTaxForBusiness({ businessId: input.businessId, subtotalCents, executor: client });
  const invoiceNumber = await allocateInvoiceNumber(client, input.businessId);

  const invoice = await query(
    `INSERT INTO invoices (business_id, client_id, invoice_number, status, subtotal_cents, tax_cents, total_cents, currency, due_date)
     VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8) RETURNING *`,
    [input.businessId, input.clientId, invoiceNumber, subtotalCents, tax.taxCents, tax.totalCents, input.currency ?? tax.jurisdiction.currency, input.dueDate ?? null],
    client
  );
  const invoiceId = invoice.rows[0].id;
  for (const line of lines) {
    await query(
      `INSERT INTO invoice_lines (business_id, invoice_id, job_id, description, quantity, unit_amount_cents, line_total_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [input.businessId, invoiceId, line.job_id ?? null, line.description, line.quantity, line.unit_amount_cents, line.quantity * line.unit_amount_cents],
      client
    );
  }
  await query('UPDATE jobs SET invoice_id = $1 WHERE business_id = $2 AND id = ANY($3::uuid[])', [invoiceId, input.businessId, input.jobIds], client);
  return invoice.rows[0];
}
