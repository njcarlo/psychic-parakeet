import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../lib/errors.js';
import { query } from '../lib/db.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { buildPatch, db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const commPreference = z.enum(['sms', 'email', 'phone', 'none']).default('email');
const clientCreateSchema = z.object({ name: z.string().min(1), email: z.string().email().optional(), phone: z.string().optional(), comm_preference: commPreference.optional(), billing_address: z.string().optional(), notes: z.string().optional() });
const clientPatchSchema = clientCreateSchema.partial();

router.get('/', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const result = await query('SELECT * FROM clients WHERE business_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3', [getBusinessId(req), page.limit, page.offset], db(req));
  res.json({ data: result.rows, ...page });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = clientCreateSchema.parse(req.body);
  const result = await query(
    `INSERT INTO clients (business_id, name, email, phone, comm_preference, billing_address, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [getBusinessId(req), body.name, body.email ?? null, body.phone ?? null, body.comm_preference ?? 'email', body.billing_address ?? null, body.notes ?? null],
    db(req)
  );
  res.status(201).json({ data: result.rows[0] });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await query('SELECT * FROM clients WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL', [id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Client not found', 'CLIENT_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = clientPatchSchema.parse(req.body);
  const patch = buildPatch(body, ['name', 'email', 'phone', 'comm_preference', 'billing_address', 'notes']);
  const result = await query(`UPDATE clients SET ${patch.fields.join(', ')}, updated_at = now() WHERE id = $${patch.values.length + 1} AND business_id = $${patch.values.length + 2} AND deleted_at IS NULL RETURNING *`, [...patch.values, id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Client not found', 'CLIENT_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await query('UPDATE clients SET deleted_at = now() WHERE id = $1 AND business_id = $2', [id, getBusinessId(req)], db(req));
  res.status(204).send();
}));

export default router;
