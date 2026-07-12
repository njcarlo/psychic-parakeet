import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { recurrenceGenerateQueue } from '../workers/queues.js';
import { buildPatch, db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const recurrenceSchema = z.object({
  client_id: z.string().uuid(),
  property_id: z.string().uuid(),
  frequency: z.enum(['weekly', 'fortnightly', 'monthly']),
  interval: z.number().int().min(1).default(1),
  start_date: z.coerce.date(),
  end_date: z.coerce.date().optional(),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  duration_minutes: z.number().int().min(15),
  price_cents: z.number().int().nonnegative().optional(),
  currency: z.string().default('NZD'),
  active: z.boolean().default(true)
});
const recurrencePatchSchema = recurrenceSchema.partial();

async function enqueueRule(ruleId: string, businessId: string): Promise<void> {
  await recurrenceGenerateQueue.add('generate-rule', { ruleId, businessId }, { jobId: `recurrence:${businessId}:${ruleId}` });
}

router.get('/', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const result = await query(
    'SELECT * FROM recurrence_rules WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [getBusinessId(req), page.limit, page.offset],
    db(req)
  );
  res.json({ data: result.rows, ...page });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = recurrenceSchema.parse(req.body);
  const businessId = getBusinessId(req);
  const result = await query(
    `INSERT INTO recurrence_rules (business_id, client_id, property_id, frequency, interval, start_date, end_date, scheduled_time, duration_minutes, price_cents, currency, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [businessId, body.client_id, body.property_id, body.frequency, body.interval, body.start_date, body.end_date ?? null, body.scheduled_time, body.duration_minutes, body.price_cents ?? null, body.currency, body.active],
    db(req)
  );
  if (body.active) await enqueueRule(result.rows[0].id, businessId);
  res.status(201).json({ data: result.rows[0] });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await query('SELECT * FROM recurrence_rules WHERE id = $1 AND business_id = $2', [id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Recurrence rule not found', 'RECURRENCE_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = recurrencePatchSchema.parse(req.body);
  const patch = buildPatch(body, ['client_id', 'property_id', 'frequency', 'interval', 'start_date', 'end_date', 'scheduled_time', 'duration_minutes', 'price_cents', 'currency', 'active']);
  const result = await query(
    `UPDATE recurrence_rules SET ${patch.fields.join(', ')}, updated_at = now()
      WHERE id = $${patch.values.length + 1} AND business_id = $${patch.values.length + 2} RETURNING *`,
    [...patch.values, id, getBusinessId(req)],
    db(req)
  );
  if (!result.rows[0]) throw new AppError(404, 'Recurrence rule not found', 'RECURRENCE_NOT_FOUND');
  if (result.rows[0].active) await enqueueRule(id, getBusinessId(req));
  res.json({ data: result.rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await query('UPDATE recurrence_rules SET active = false, updated_at = now() WHERE id = $1 AND business_id = $2', [id, getBusinessId(req)], db(req));
  res.status(204).send();
}));

export default router;
