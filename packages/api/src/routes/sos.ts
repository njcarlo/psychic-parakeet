import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const triggerSchema = z.object({ job_id: z.string().uuid().optional(), lat: z.number().optional(), lng: z.number().optional(), notes: z.string().optional() });
const resolveSchema = z.object({ notes: z.string().min(1).optional() });

async function notifyOfficeAdmins(_businessId: string, _sosId: string): Promise<void> {
  // Stub for SMS/email/push fan-out to the office team.
}

router.post('/trigger', asyncHandler(async (req, res) => {
  const body = triggerSchema.parse(req.body);
  const result = await query(
    `INSERT INTO sos_alerts (business_id, user_id, job_id, lat, lng, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [getBusinessId(req), req.user!.id, body.job_id ?? null, body.lat ?? null, body.lng ?? null, body.notes ?? null],
    db(req)
  );
  await notifyOfficeAdmins(getBusinessId(req), result.rows[0].id);
  res.status(201).json({ data: result.rows[0] });
}));

router.get('/', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const result = await query('SELECT * FROM sos_alerts WHERE business_id = $1 AND resolved_at IS NULL ORDER BY triggered_at DESC LIMIT $2 OFFSET $3', [getBusinessId(req), page.limit, page.offset], db(req));
  res.json({ data: result.rows, ...page });
}));

router.patch('/:id/resolve', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = resolveSchema.parse(req.body);
  const result = await query(
    `UPDATE sos_alerts SET resolved_by = $1, resolved_at = now(), notes = COALESCE($2, notes)
      WHERE id = $3 AND business_id = $4 AND resolved_at IS NULL RETURNING *`,
    [req.user!.id, body.notes ?? null, id, getBusinessId(req)],
    db(req)
  );
  if (!result.rows[0]) throw new AppError(404, 'Open SOS event not found', 'SOS_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

export default router;
