import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { enqueueRecurrenceGenerate } from '../workers/queues.js';
import { buildPatch, db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const recurrenceSchema = z.object({
  client_id: z.string().uuid(),
  property_id: z.string().uuid(),
  frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'custom']),
  interval_weeks: z.number().int().min(1).default(1),
  day_of_week: z.number().int().min(0).max(6).optional(),
  preferred_start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  duration_minutes: z.number().int().min(15),
  cleaner_id: z.string().uuid().optional(),
  checklist_template_id: z.string().uuid().optional(),
  price_cents: z.number().int().nonnegative(),
  active: z.boolean().default(true),
  starts_on: z.coerce.date(),
  ends_on: z.coerce.date().optional(),
  notes: z.string().optional()
});
const recurrencePatchSchema = recurrenceSchema.partial();

async function enqueueRule(ruleId: string, businessId: string): Promise<void> {
  await enqueueRecurrenceGenerate({ ruleId, businessId });
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
    `INSERT INTO recurrence_rules (
       business_id, client_id, property_id, frequency, interval_weeks, day_of_week,
       preferred_start_time, duration_minutes, cleaner_id, checklist_template_id,
       price_cents, active, starts_on, ends_on, notes
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [
      businessId,
      body.client_id,
      body.property_id,
      body.frequency,
      body.interval_weeks,
      body.day_of_week ?? null,
      body.preferred_start_time ?? null,
      body.duration_minutes,
      body.cleaner_id ?? null,
      body.checklist_template_id ?? null,
      body.price_cents,
      body.active,
      body.starts_on,
      body.ends_on ?? null,
      body.notes ?? null
    ],
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
  const patch = buildPatch(body, [
    'client_id',
    'property_id',
    'frequency',
    'interval_weeks',
    'day_of_week',
    'preferred_start_time',
    'duration_minutes',
    'cleaner_id',
    'checklist_template_id',
    'price_cents',
    'active',
    'starts_on',
    'ends_on',
    'notes'
  ]);
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
