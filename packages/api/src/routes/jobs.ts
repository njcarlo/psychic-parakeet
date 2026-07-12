import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { buildPatch, db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const jobStatus = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled', 'skipped']);
const createJobSchema = z.object({ client_id: z.string().uuid(), property_id: z.string().uuid(), recurrence_rule_id: z.string().uuid().optional(), scheduled_start: z.coerce.date(), scheduled_end: z.coerce.date(), status: jobStatus.default('scheduled'), price_cents: z.number().int().nonnegative(), notes: z.string().optional(), client_generated_id: z.string().min(1).optional() }).refine((value) => value.scheduled_end > value.scheduled_start, 'scheduled_end must be after scheduled_start');
const patchJobSchema = createJobSchema.omit({ client_id: true, property_id: true, recurrence_rule_id: true }).partial();
const assignSchema = z.object({ user_ids: z.array(z.string().uuid()).min(1) });
const calendarSchema = z.object({ start: z.coerce.date(), end: z.coerce.date() });
const gapsSchema = z.object({ user_id: z.string().uuid(), date: z.coerce.date(), duration_minutes: z.number().int().min(15).max(720) });

router.get('/', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const filters = z.object({ status: jobStatus.optional(), user_id: z.string().uuid().optional(), start: z.coerce.date().optional(), end: z.coerce.date().optional() }).parse(req.query);
  const params: unknown[] = [getBusinessId(req)];
  const where = ['j.business_id = $1'];
  if (filters.status) { params.push(filters.status); where.push(`j.status = $${params.length}`); }
  if (filters.start) { params.push(filters.start); where.push(`j.scheduled_start >= $${params.length}`); }
  if (filters.end) { params.push(filters.end); where.push(`j.scheduled_start < $${params.length}`); }
  if (filters.user_id) { params.push(filters.user_id); where.push(`EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = $${params.length})`); }
  params.push(page.limit, page.offset);
  const result = await query(`SELECT j.* FROM jobs j WHERE ${where.join(' AND ')} ORDER BY j.scheduled_start ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params, db(req));
  res.json({ data: result.rows, ...page });
}));

router.get('/calendar', asyncHandler(async (req, res) => {
  const range = calendarSchema.parse(req.query);
  const result = await query(
    `SELECT j.*, COALESCE(json_agg(ja.user_id) FILTER (WHERE ja.user_id IS NOT NULL), '[]') AS user_ids
       FROM jobs j LEFT JOIN job_assignments ja ON ja.job_id = j.id
      WHERE j.business_id = $1 AND j.scheduled_start >= $2 AND j.scheduled_start < $3
      GROUP BY j.id ORDER BY j.scheduled_start`,
    [getBusinessId(req), range.start, range.end],
    db(req)
  );
  res.json({ data: result.rows });
}));

router.post('/find-gaps', asyncHandler(async (req, res) => {
  const body = gapsSchema.parse(req.body);
  const startOfDay = new Date(body.date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const busy = await query<{ scheduled_start: Date; scheduled_end: Date }>(
    `SELECT j.scheduled_start, j.scheduled_end FROM jobs j JOIN job_assignments ja ON ja.job_id = j.id
      WHERE j.business_id = $1 AND ja.user_id = $2 AND j.status NOT IN ('cancelled', 'skipped')
        AND j.scheduled_start < $4 AND j.scheduled_end > $3 ORDER BY j.scheduled_start`,
    [getBusinessId(req), body.user_id, startOfDay, endOfDay],
    db(req)
  );
  const gaps: Array<{ start: string; end: string }> = [];
  let cursor = startOfDay.getTime();
  for (const slot of busy.rows) {
    const slotStart = new Date(slot.scheduled_start).getTime();
    if (slotStart - cursor >= body.duration_minutes * 60_000) gaps.push({ start: new Date(cursor).toISOString(), end: new Date(slotStart).toISOString() });
    cursor = Math.max(cursor, new Date(slot.scheduled_end).getTime());
  }
  if (endOfDay.getTime() - cursor >= body.duration_minutes * 60_000) gaps.push({ start: new Date(cursor).toISOString(), end: endOfDay.toISOString() });
  res.json({ data: gaps });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = createJobSchema.parse(req.body);
  const result = await query(
    `INSERT INTO jobs (business_id, client_id, property_id, recurrence_rule_id, scheduled_start, scheduled_end, status, price_cents, notes, client_generated_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (business_id, client_generated_id)
       DO UPDATE SET client_generated_id = EXCLUDED.client_generated_id
     RETURNING *`,
    [getBusinessId(req), body.client_id, body.property_id, body.recurrence_rule_id ?? null, body.scheduled_start, body.scheduled_end, body.status, body.price_cents, body.notes ?? null, body.client_generated_id ?? null],
    db(req)
  );
  res.status(201).json({ data: result.rows[0] });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = patchJobSchema.parse(req.body);
  const patch = buildPatch(body, ['scheduled_start', 'scheduled_end', 'status', 'price_cents', 'notes', 'client_generated_id']);
  const result = await query(`UPDATE jobs SET ${patch.fields.join(', ')}, updated_at = now() WHERE id = $${patch.values.length + 1} AND business_id = $${patch.values.length + 2} RETURNING *`, [...patch.values, id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Job not found', 'JOB_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

router.post('/:id/assignments', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = assignSchema.parse(req.body);
  await query('DELETE FROM job_assignments WHERE business_id = $1 AND job_id = $2', [getBusinessId(req), id], db(req));
  const rows = await Promise.all(body.user_ids.map((userId) => query('INSERT INTO job_assignments (business_id, job_id, user_id) VALUES ($1,$2,$3) ON CONFLICT (job_id, user_id) DO NOTHING RETURNING *', [getBusinessId(req), id, userId], db(req))));
  res.json({ data: rows.flatMap((r) => r.rows) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await query('SELECT * FROM jobs WHERE id = $1 AND business_id = $2', [id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Job not found', 'JOB_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

export default router;
