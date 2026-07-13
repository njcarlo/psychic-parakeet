import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import type { DbExecutor } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { sendPushToTokens } from '../lib/firebase.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const triggerSchema = z
  .object({
    job_id: z.string().uuid().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    notes: z.string().optional(),
    message: z.string().optional()
  })
  .transform((value) => ({
    job_id: value.job_id,
    lat: value.lat ?? value.latitude,
    lng: value.lng ?? value.longitude,
    notes: value.notes ?? value.message
  }));
const resolveSchema = z.object({ notes: z.string().min(1).optional() });

async function notifyOfficeAdmins(businessId: string, sosId: string, client?: DbExecutor): Promise<void> {
  try {
    const result = await query<{ token: string }>(
      `SELECT DISTINCT dpt.token
         FROM device_push_tokens dpt
         JOIN users u ON u.id = dpt.user_id
        WHERE dpt.business_id = $1
          AND u.business_id = $1
          AND u.active = true
          AND u.role IN ('owner', 'office_admin')`,
      [businessId],
      client
    );

    await sendPushToTokens(result.rows.map((row) => row.token), {
      notification: {
        title: 'CleanOps SOS alert',
        body: 'A cleaner triggered an SOS alert.'
      },
      data: {
        type: 'sos_alert',
        sos_id: sosId,
        business_id: businessId
      }
    });
  } catch (error) {
    // SOS creation should not fail if Firebase or push-token storage is unavailable.
    console.warn('Failed to send SOS push notifications', error);
  }
}

router.post('/trigger', asyncHandler(async (req, res) => {
  const body = triggerSchema.parse(req.body);
  const result = await query(
    `INSERT INTO sos_alerts (business_id, user_id, job_id, lat, lng, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [getBusinessId(req), req.user!.id, body.job_id ?? null, body.lat ?? null, body.lng ?? null, body.notes ?? null],
    db(req)
  );
  await notifyOfficeAdmins(getBusinessId(req), result.rows[0].id, db(req));
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
