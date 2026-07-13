import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { haversineKm } from '../services/time.js';
import { db, getBusinessId } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const gpsSchema = z
  .object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
  })
  .transform((value) => ({
    lat: value.lat ?? value.latitude,
    lng: value.lng ?? value.longitude
  }));
const clockInSchema = gpsSchema.and(z.object({ job_id: z.string().uuid(), client_generated_id: z.string().min(1).optional() }));
const clockOutSchema = gpsSchema.and(
  z.object({
    time_entry_id: z.string().uuid().optional(),
    job_id: z.string().uuid().optional(),
    client_generated_id: z.string().min(1).optional()
  })
);

async function computeMileageKm(req: Express.Request, jobId: string, cleanerId: string): Promise<number | null> {
  const current = await query<{ lat: number | null; lng: number | null }>(
    `SELECT p.lat, p.lng FROM jobs j JOIN properties p ON p.id = j.property_id WHERE j.id = $1 AND j.business_id = $2`,
    [jobId, getBusinessId(req)],
    db(req)
  );
  const currentCoords = current.rows[0];
  if (currentCoords?.lat == null || currentCoords.lng == null) return null;

  const previous = await query<{ lat: number | null; lng: number | null }>(
    `SELECT p.lat, p.lng
       FROM time_entries te
       JOIN jobs j ON j.id = te.job_id
       JOIN properties p ON p.id = j.property_id
      WHERE te.business_id = $1 AND te.user_id = $2 AND te.clock_out_at IS NOT NULL AND te.job_id <> $3
      ORDER BY te.clock_out_at DESC LIMIT 1`,
    [getBusinessId(req), cleanerId, jobId],
    db(req)
  );
  const previousCoords = previous.rows[0];
  if (previousCoords?.lat == null || previousCoords.lng == null) return null;
  return Number(haversineKm(
    { lat: previousCoords.lat, lng: previousCoords.lng },
    { lat: currentCoords.lat, lng: currentCoords.lng }
  ).toFixed(2));
}

router.post('/clock-in', asyncHandler(async (req, res) => {
  const body = clockInSchema.parse(req.body);
  const businessId = getBusinessId(req);
  if (body.client_generated_id) {
    const existing = await query('SELECT * FROM time_entries WHERE business_id = $1 AND client_generated_id = $2', [businessId, body.client_generated_id], db(req));
    if (existing.rows[0]) return res.json({ data: existing.rows[0], idempotent: true });
  }
  const mileageKm = await computeMileageKm(req, body.job_id, req.user!.id);
  const gpsMissing = body.lat == null || body.lng == null;
  const result = await query(
    `INSERT INTO time_entries (business_id, job_id, user_id, clock_in_at, clock_in_lat, clock_in_lng, gps_missing, mileage_km, client_generated_id)
     VALUES ($1,$2,$3,now(),$4,$5,$6,$7,$8) RETURNING *`,
    [businessId, body.job_id, req.user!.id, body.lat ?? null, body.lng ?? null, gpsMissing, mileageKm, body.client_generated_id ?? null],
    db(req)
  );
  await query(
    `UPDATE jobs SET status = 'in_progress', updated_at = now()
      WHERE id = $1 AND business_id = $2 AND status = 'scheduled'`,
    [body.job_id, businessId],
    db(req)
  );
  res.status(201).json({ data: result.rows[0] });
}));

router.post('/clock-out', asyncHandler(async (req, res) => {
  const body = clockOutSchema.parse(req.body);
  if (!body.time_entry_id && !body.job_id) throw new AppError(400, 'time_entry_id or job_id is required', 'TIME_ENTRY_TARGET_REQUIRED');
  const params: unknown[] = [getBusinessId(req), req.user!.id, body.lat ?? null, body.lng ?? null, body.lat == null || body.lng == null];
  const where = body.time_entry_id ? 'id = $6' : 'job_id = $6 AND clock_out_at IS NULL';
  params.push(body.time_entry_id ?? body.job_id);
  const result = await query(
    `UPDATE time_entries SET clock_out_at = now(), clock_out_lat = $3, clock_out_lng = $4, gps_missing = gps_missing OR $5
      WHERE business_id = $1 AND user_id = $2 AND ${where} RETURNING *`,
    params,
    db(req)
  );
  if (!result.rows[0]) throw new AppError(404, 'Open time entry not found', 'TIME_ENTRY_NOT_FOUND');
  await query(
    `UPDATE jobs SET status = 'completed', updated_at = now()
      WHERE id = $1 AND business_id = $2 AND status IN ('in_progress', 'scheduled')`,
    [result.rows[0].job_id, getBusinessId(req)],
    db(req)
  );
  res.json({ data: result.rows[0] });
}));

export default router;
