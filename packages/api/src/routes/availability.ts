import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, requireRole, tenancy } from '../middleware/auth.js';
import { buildPatch, db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const availabilitySchema = z.object({ user_id: z.string().uuid().optional(), day_of_week: z.number().int().min(0).max(6), start_time: z.string(), end_time: z.string() });
const timeOffSchema = z.object({ starts_at: z.coerce.date(), ends_at: z.coerce.date(), reason: z.string().optional() }).refine((v) => v.ends_at > v.starts_at, 'ends_at must be after starts_at');
const decisionSchema = z.object({ reason: z.string().optional() });
const canManageAvailability = (role: string | undefined) => role === 'owner' || role === 'office_admin';

router.get('/', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const result = await query('SELECT * FROM cleaner_availability WHERE business_id = $1 ORDER BY user_id, day_of_week LIMIT $2 OFFSET $3', [getBusinessId(req), page.limit, page.offset], db(req));
  res.json({ data: result.rows, ...page });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = availabilitySchema.parse(req.body);
  const userId = canManageAvailability(req.user?.role) ? body.user_id ?? req.user!.id : req.user!.id;
  const result = await query(
    `INSERT INTO cleaner_availability (business_id, user_id, day_of_week, start_time, end_time)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [getBusinessId(req), userId, body.day_of_week, body.start_time, body.end_time],
    db(req)
  );
  res.status(201).json({ data: result.rows[0] });
}));

router.patch('/:id', requireRole('owner', 'office_admin'), asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = availabilitySchema.partial().parse(req.body);
  const patch = buildPatch(body, ['user_id', 'day_of_week', 'start_time', 'end_time']);
  const result = await query(`UPDATE cleaner_availability SET ${patch.fields.join(', ')} WHERE id = $${patch.values.length + 1} AND business_id = $${patch.values.length + 2} RETURNING *`, [...patch.values, id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Availability not found', 'AVAILABILITY_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

router.delete('/:id', requireRole('owner', 'office_admin'), asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await query('DELETE FROM cleaner_availability WHERE id = $1 AND business_id = $2', [id, getBusinessId(req)], db(req));
  res.status(204).send();
}));

router.post('/time-off', asyncHandler(async (req, res) => {
  const body = timeOffSchema.parse(req.body);
  const result = await query(
    `INSERT INTO cleaner_time_off (business_id, user_id, starts_at, ends_at, reason, status)
     VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
    [getBusinessId(req), req.user!.id, body.starts_at, body.ends_at, body.reason ?? null],
    db(req)
  );
  res.status(201).json({ data: result.rows[0] });
}));

router.patch('/time-off/:id/approve', requireRole('owner', 'office_admin'), asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = decisionSchema.parse(req.body);
  const result = await query("UPDATE cleaner_time_off SET status = 'approved', reviewed_by = $1, reviewed_at = now(), reason = COALESCE($2, reason) WHERE id = $3 AND business_id = $4 RETURNING *", [req.user!.id, body.reason ?? null, id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Time-off request not found', 'TIME_OFF_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

router.patch('/time-off/:id/reject', requireRole('owner', 'office_admin'), asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = decisionSchema.parse(req.body);
  const result = await query("UPDATE cleaner_time_off SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), reason = COALESCE($2, reason) WHERE id = $3 AND business_id = $4 RETURNING *", [req.user!.id, body.reason ?? null, id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Time-off request not found', 'TIME_OFF_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

export default router;
