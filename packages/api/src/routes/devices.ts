import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { db, getBusinessId } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const platformSchema = z.enum(['web', 'ios', 'android']);
const registerPushTokenSchema = z.object({
  token: z.string().trim().min(1).max(4096),
  platform: platformSchema
});
const unregisterPushTokenSchema = z.object({
  token: z.string().trim().min(1).max(4096)
});

router.post('/push-token', asyncHandler(async (req, res) => {
  const body = registerPushTokenSchema.parse(req.body);
  const result = await query(
    `INSERT INTO device_push_tokens (business_id, user_id, token, platform)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, token) DO UPDATE SET
       business_id = EXCLUDED.business_id,
       platform = EXCLUDED.platform,
       updated_at = now()
     RETURNING *`,
    [getBusinessId(req), req.user!.id, body.token, body.platform],
    db(req)
  );

  res.status(201).json({ data: result.rows[0] });
}));

router.delete('/push-token', asyncHandler(async (req, res) => {
  const body = unregisterPushTokenSchema.parse(req.body);
  const result = await query(
    'DELETE FROM device_push_tokens WHERE business_id = $1 AND user_id = $2 AND token = $3',
    [getBusinessId(req), req.user!.id, body.token],
    db(req)
  );

  res.json({ deleted: result.rowCount ?? 0 });
}));

export default router;
