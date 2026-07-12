import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { haversineKm } from '../services/time.js';
import { db, getBusinessId } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const gpsSchema = z.object({ latitude: z.number().optional(), longitude: z.number().optional() });
const clockInSchema = gpsSchema.extend({ job_id: z.string().uuid(), client_generated_id: z.string().min(1).optional() });
const clockOutSchema = gpsSchema.extend({ time_entry_id: z.string().uuid().optional(), job_id: z.string().uuid().optional(), client_generated_id: z.string().min(1).optional() });

async function computeMileageKm(req: Express.Request, jobId: string, cleanerId: string): Promise<number | null> {
  const current = await query<{ latitude: number | null; longitude: number | null }>(
    `SELECT p.latitude, p.longitude FROM jobs j JOIN properties p ON p.id = j.property_id WHERE j.id = $1 AND j.business_id = $2`,
    [jobId, getBusinessId(req)],
    db(req)
  );
  const currentCoords = current.rows[0];
  if (currentCoords?.latitude == null || currentCoords.longitude == null) return null;

  const previous = await query<{ latitude: number | null; longitude: number | null }>(
    `SELECT p.latitude, p.longitude
       FROM time_entries te
       JOIN jobs j ON j.id = te.job_id
       JOIN properties p ON p.id = j.property_id
      WHERE te.business_id = $1 AND te.user_id = $2 AND te.clock_out_at IS NOT NULL AND te.job_id <> $3
      ORDER BY te.clock_out_at DESC LIMIT 1`,
    [getBusinessId(req), cleanerId, jobId],
    db(req)
  );
  const previousCoords = previous.rows[0];
  if (previousCoords?.latitude == null || previousCoords.longitude == null) return null;
  return Number(haversineKm(
    { latitude: previousCoords.latitude, longitude: previousCoords.longitude },
    { latitude: currentCoords.latitude, longitude: currentCoords.longitude }
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
  const gpsMissing = body.latitude == null || body.longitude == null;
  const result = await query(
    `INSERT INTO time_entries (business_id, job_id, user_id, clock_in_at, clock_in_latitude, clock_in_longitude, gps_missing, mileage_km, client_generated_id)
     VALUES ($1,$2,$3,now(),$4,$5,$6,$7,$8) RETURNING *`,
    [businessId, body.job_id, req.user!.id, body.latitude ?? null, body.longitude ?? null, gpsMissing, mileageKm, body.client_generated_id ?? null],
    db(req)
  );
  res.status(201).json({ data: result.rows[0] });
}));

router.post('/clock-out', asyncHandler(async (req, res) => {
  const body = clockOutSchema.parse(req.body);
  if (!body.time_entry_id && !body.job_id) throw new AppError(400, 'time_entry_id or job_id is required', 'TIME_ENTRY_TARGET_REQUIRED');
  const params: unknown[] = [getBusinessId(req), req.user!.id, body.latitude ?? null, body.longitude ?? null, body.latitude == null || body.longitude == null];
  const where = body.time_entry_id ? 'id = $6' : 'job_id = $6 AND clock_out_at IS NULL';
  params.push(body.time_entry_id ?? body.job_id);
  const result = await query(
    `UPDATE time_entries SET clock_out_at = now(), clock_out_latitude = $3, clock_out_longitude = $4, gps_missing = gps_missing OR $5, updated_at = now()
      WHERE business_id = $1 AND user_id = $2 AND ${where} RETURNING *`,
    params,
    db(req)
  );
  if (!result.rows[0]) throw new AppError(404, 'Open time entry not found', 'TIME_ENTRY_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

export default router;
