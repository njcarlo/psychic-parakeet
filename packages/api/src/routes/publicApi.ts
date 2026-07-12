import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateApiKey, tenancy } from '../middleware/auth.js';
import { publicApiRateLimit } from '../middleware/rateLimit.js';
import { buildPatch, db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(publicApiRateLimit, authenticateApiKey, tenancy);

const clientSchema = z.object({ name: z.string().min(1), email: z.string().email().optional(), phone: z.string().optional(), comm_preference: z.enum(['sms', 'email', 'phone', 'none']).default('email') });
const propertySchema = z.object({ client_id: z.string().uuid(), name: z.string().min(1), address_line1: z.string().min(1), city: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional() });
const jobSchema = z.object({ client_id: z.string().uuid(), property_id: z.string().uuid(), scheduled_start: z.coerce.date(), scheduled_end: z.coerce.date(), price_cents: z.number().int().nonnegative().optional(), notes: z.string().optional() });

router.get('/clients', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const result = await query('SELECT id, name, email, phone, comm_preference, created_at, updated_at FROM clients WHERE business_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3', [getBusinessId(req), page.limit, page.offset], db(req));
  res.json({ data: result.rows, ...page });
}));

router.post('/clients', asyncHandler(async (req, res) => {
  const body = clientSchema.parse(req.body);
  const result = await query('INSERT INTO clients (business_id, name, email, phone, comm_preference) VALUES ($1,$2,$3,$4,$5) RETURNING *', [getBusinessId(req), body.name, body.email ?? null, body.phone ?? null, body.comm_preference], db(req));
  res.status(201).json({ data: result.rows[0] });
}));

router.patch('/clients/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = clientSchema.partial().parse(req.body);
  const patch = buildPatch(body, ['name', 'email', 'phone', 'comm_preference']);
  const result = await query(`UPDATE clients SET ${patch.fields.join(', ')}, updated_at = now() WHERE id = $${patch.values.length + 1} AND business_id = $${patch.values.length + 2} RETURNING *`, [...patch.values, id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Client not found', 'CLIENT_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

router.get('/properties', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const result = await query('SELECT id, client_id, name, address_line1, city, latitude, longitude FROM properties WHERE business_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3', [getBusinessId(req), page.limit, page.offset], db(req));
  res.json({ data: result.rows, ...page });
}));

router.post('/properties', asyncHandler(async (req, res) => {
  const body = propertySchema.parse(req.body);
  const result = await query('INSERT INTO properties (business_id, client_id, name, address_line1, city, latitude, longitude) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [getBusinessId(req), body.client_id, body.name, body.address_line1, body.city ?? null, body.latitude ?? null, body.longitude ?? null], db(req));
  res.status(201).json({ data: result.rows[0] });
}));

router.get('/jobs', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const result = await query('SELECT id, client_id, property_id, scheduled_start, scheduled_end, status, price_cents, currency FROM jobs WHERE business_id = $1 ORDER BY scheduled_start DESC LIMIT $2 OFFSET $3', [getBusinessId(req), page.limit, page.offset], db(req));
  res.json({ data: result.rows, ...page });
}));

router.post('/jobs', asyncHandler(async (req, res) => {
  const body = jobSchema.parse(req.body);
  const result = await query(
    `INSERT INTO jobs (business_id, client_id, property_id, scheduled_start, scheduled_end, status, price_cents, notes)
     VALUES ($1,$2,$3,$4,$5,'scheduled',$6,$7) RETURNING *`,
    [getBusinessId(req), body.client_id, body.property_id, body.scheduled_start, body.scheduled_end, body.price_cents ?? null, body.notes ?? null],
    db(req)
  );
  res.status(201).json({ data: result.rows[0] });
}));

export default router;
