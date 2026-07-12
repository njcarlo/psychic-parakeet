import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { buildPatch, db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const propertyCreateSchema = z.object({ client_id: z.string().uuid(), name: z.string().min(1), address_line1: z.string().min(1), address_line2: z.string().optional(), city: z.string().optional(), region: z.string().optional(), postal_code: z.string().optional(), country: z.string().default('NZ'), latitude: z.number().optional(), longitude: z.number().optional(), access_notes: z.string().optional(), service_notes: z.string().optional() });
const propertyPatchSchema = propertyCreateSchema.omit({ client_id: true }).partial();

async function logAccess(req: Express.Request, propertyId: string, action: 'view' | 'update'): Promise<void> {
  await query('INSERT INTO property_access_log (business_id, property_id, user_id, action) VALUES ($1, $2, $3, $4)', [getBusinessId(req), propertyId, req.user?.id ?? null, action], db(req));
}

router.get('/', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const result = await query('SELECT * FROM properties WHERE business_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3', [getBusinessId(req), page.limit, page.offset], db(req));
  res.json({ data: result.rows, ...page });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = propertyCreateSchema.parse(req.body);
  const result = await query(
    `INSERT INTO properties (business_id, client_id, name, address_line1, address_line2, city, region, postal_code, country, latitude, longitude, access_notes, service_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [getBusinessId(req), body.client_id, body.name, body.address_line1, body.address_line2 ?? null, body.city ?? null, body.region ?? null, body.postal_code ?? null, body.country, body.latitude ?? null, body.longitude ?? null, body.access_notes ?? null, body.service_notes ?? null],
    db(req)
  );
  res.status(201).json({ data: result.rows[0] });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await query('SELECT * FROM properties WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL', [id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Property not found', 'PROPERTY_NOT_FOUND');
  if (result.rows[0].access_notes) await logAccess(req, id, 'view');
  res.json({ data: result.rows[0] });
}));

router.get('/:id/access-notes', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await query('SELECT id, access_notes FROM properties WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL', [id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Property not found', 'PROPERTY_NOT_FOUND');
  await logAccess(req, id, 'view');
  res.json({ property_id: id, access_notes: result.rows[0].access_notes });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = propertyPatchSchema.parse(req.body);
  const patch = buildPatch(body, ['name', 'address_line1', 'address_line2', 'city', 'region', 'postal_code', 'country', 'latitude', 'longitude', 'access_notes', 'service_notes']);
  const result = await query(`UPDATE properties SET ${patch.fields.join(', ')}, updated_at = now() WHERE id = $${patch.values.length + 1} AND business_id = $${patch.values.length + 2} AND deleted_at IS NULL RETURNING *`, [...patch.values, id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Property not found', 'PROPERTY_NOT_FOUND');
  if (body.access_notes !== undefined) await logAccess(req, id, 'update');
  res.json({ data: result.rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await query('UPDATE properties SET deleted_at = now() WHERE id = $1 AND business_id = $2', [id, getBusinessId(req)], db(req));
  res.status(204).send();
}));

export default router;
