import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { db, getBusinessId } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const earningsQuerySchema = z.object({ cleaner_id: z.string().uuid().optional(), start: z.coerce.date(), end: z.coerce.date() });

router.get('/', asyncHandler(async (req, res) => {
  const params = earningsQuerySchema.parse(req.query);
  const cleanerId = params.cleaner_id ?? req.user!.id;
  const result = await query<{
    cleaner_id: string;
    hours: number;
    hourly_earnings_cents: number;
    per_job_earnings_cents: number;
  }>(
    `SELECT te.user_id AS cleaner_id,
            COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out_at - te.clock_in_at)) / 3600), 0) AS hours,
            COALESCE(SUM((EXTRACT(EPOCH FROM (te.clock_out_at - te.clock_in_at)) / 3600) * COALESCE(u.pay_rate_cents, 0)), 0)::int AS hourly_earnings_cents,
            COALESCE(SUM(COALESCE(ja.pay_cents, 0)), 0)::int AS per_job_earnings_cents
       FROM time_entries te
       JOIN users u ON u.id = te.user_id
       LEFT JOIN job_assignments ja ON ja.job_id = te.job_id AND ja.cleaner_id = te.user_id
      WHERE te.business_id = $1 AND te.user_id = $2 AND te.clock_in_at >= $3 AND te.clock_in_at < $4 AND te.clock_out_at IS NOT NULL
      GROUP BY te.user_id`,
    [getBusinessId(req), cleanerId, params.start, params.end],
    db(req)
  );
  const row = result.rows[0] ?? { cleaner_id: cleanerId, hours: 0, hourly_earnings_cents: 0, per_job_earnings_cents: 0 };
  res.json({ data: { ...row, total_earnings_cents: Number(row.hourly_earnings_cents) + Number(row.per_job_earnings_cents) } });
}));

export default router;
