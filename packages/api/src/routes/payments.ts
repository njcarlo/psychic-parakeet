import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { applyPaymentEvent, payMongoAdapter, stripeAdapter, windcaveAdapter, type PaymentProviderAdapter } from '../services/payments.js';
import { db, getBusinessId, idParamSchema } from './helpers.js';

const router = Router();
const manualPaymentSchema = z.object({ invoice_id: z.string().uuid(), amount_cents: z.number().int().positive(), currency: z.string().default('NZD'), paid_at: z.coerce.date().optional(), reference: z.string().optional() });

router.post('/record', authenticateJwt, tenancy, asyncHandler(async (req, res) => {
  const body = manualPaymentSchema.parse(req.body);
  const result = await query(
    `INSERT INTO payments (business_id, invoice_id, provider, provider_event_id, amount_cents, currency, status, paid_at, reference)
     VALUES ($1,$2,'manual_bank',$3,$4,$5,'succeeded',$6,$7) RETURNING *`,
    [getBusinessId(req), body.invoice_id, `manual:${body.reference ?? crypto.randomUUID()}`, body.amount_cents, body.currency, body.paid_at ?? new Date(), body.reference ?? null],
    db(req)
  );
  res.status(201).json({ data: result.rows[0] });
}));

router.post('/manual-bank/confirm', authenticateJwt, tenancy, asyncHandler(async (req, res) => {
  const body = manualPaymentSchema.parse(req.body);
  const payment = await applyPaymentEvent(getBusinessId(req), {
    provider: 'manual_bank',
    providerEventId: `ph-bank:${body.reference ?? crypto.randomUUID()}`,
    invoiceId: body.invoice_id,
    amountCents: body.amount_cents,
    currency: body.currency,
    status: 'succeeded',
    paidAt: body.paid_at ?? new Date(),
    raw: body
  });
  res.status(201).json({ data: payment });
}));

async function handleWebhook(adapter: PaymentProviderAdapter, req: Request, res: Response) {
  const signature = req.header('stripe-signature') ?? req.header('x-windcave-signature') ?? req.header('paymongo-signature');
  const raw = JSON.stringify(req.body);
  if (!adapter.verifySignature(raw, signature)) {
    throw new AppError(401, 'Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
  }
  const event = adapter.normalize(req.body);
  const businessId = String((req.body as Record<string, any>).businessId ?? (req.body as Record<string, any>).business_id ?? '');
  if (!businessId) throw new AppError(400, 'businessId is required in webhook metadata', 'WEBHOOK_BUSINESS_REQUIRED');
  const payment = await applyPaymentEvent(businessId, event);
  res.json({ received: true, data: payment });
}

router.post('/webhooks/stripe', asyncHandler((req, res) => handleWebhook(stripeAdapter, req, res)));
router.post('/webhooks/windcave', asyncHandler((req, res) => handleWebhook(windcaveAdapter, req, res)));
router.post('/webhooks/paymongo', asyncHandler((req, res) => handleWebhook(payMongoAdapter, req, res)));

router.get('/:id', authenticateJwt, tenancy, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await query('SELECT * FROM payments WHERE id = $1 AND business_id = $2', [id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

export default router;
