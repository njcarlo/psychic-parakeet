import { Router } from 'express';
import { z } from 'zod';
import { withBusinessContext, query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { createInvoiceFromJobs } from '../services/invoicing.js';
import { renderInvoicePdf } from '../services/pdf.js';
import { db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const createInvoiceSchema = z.object({ client_id: z.string().uuid(), job_ids: z.array(z.string().uuid()).min(1), due_date: z.coerce.date().optional(), currency: z.string().optional() });

router.get('/', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const result = await query('SELECT * FROM invoices WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [getBusinessId(req), page.limit, page.offset], db(req));
  res.json({ data: result.rows, ...page });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = createInvoiceSchema.parse(req.body);
  const businessId = getBusinessId(req);
  const invoice = await withBusinessContext(businessId, (client) => createInvoiceFromJobs(client, { businessId, clientId: body.client_id, jobIds: body.job_ids, dueDate: body.due_date, currency: body.currency }));
  res.status(201).json({ data: invoice });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const invoice = await query('SELECT * FROM invoices WHERE id = $1 AND business_id = $2', [id, getBusinessId(req)], db(req));
  if (!invoice.rows[0]) throw new AppError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
  const lines = await query('SELECT * FROM invoice_lines WHERE invoice_id = $1 AND business_id = $2 ORDER BY created_at', [id, getBusinessId(req)], db(req));
  res.json({ data: { ...invoice.rows[0], lines: lines.rows } });
}));

router.post('/:id/pdf', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const invoice = await query('SELECT * FROM invoices WHERE id = $1 AND business_id = $2', [id, getBusinessId(req)], db(req));
  if (!invoice.rows[0]) throw new AppError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
  const lines = await query('SELECT * FROM invoice_lines WHERE invoice_id = $1 AND business_id = $2 ORDER BY created_at', [id, getBusinessId(req)], db(req));
  const buffer = await renderInvoicePdf({ invoice: invoice.rows[0], lines: lines.rows });
  res.type('application/pdf').send(buffer);
}));

router.patch('/:id/sent', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await query("UPDATE invoices SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1 AND business_id = $2 AND status <> 'void' RETURNING *", [id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

router.patch('/:id/void', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await query("UPDATE invoices SET status = 'void', voided_at = now(), updated_at = now() WHERE id = $1 AND business_id = $2 RETURNING *", [id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

export default router;
