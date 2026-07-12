import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { asyncHandler } from '../lib/errors.js';
import { authenticateJwt, requireRole, tenancy } from '../middleware/auth.js';
import { getTaxJurisdictions } from '../services/tax.js';
import { db, getBusinessId } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

router.get('/jurisdictions', asyncHandler(async (req, res) => {
  res.json({ data: await getTaxJurisdictions(db(req)) });
}));

router.patch('/pricing-mode', requireRole('owner', 'office_admin'), asyncHandler(async (req, res) => {
  const body = z.object({ pricing_mode: z.enum(['inclusive', 'exclusive']), country_code: z.string().length(2).optional() }).parse(req.body);
  const result = await query(
    'UPDATE businesses SET pricing_mode = $1, country_code = COALESCE($2, country_code), updated_at = now() WHERE id = $3 RETURNING id, pricing_mode, country_code',
    [body.pricing_mode, body.country_code ?? null, getBusinessId(req)],
    db(req)
  );
  res.json({ data: result.rows[0] });
}));

export default router;
