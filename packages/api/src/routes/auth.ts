import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../lib/config.js';
import { query, withTransaction } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, signAccessToken } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  businessName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  ownerName: z.string().min(1).optional(),
  phone: z.string().optional(),
  timezone: z.string().default('UTC'),
  jurisdictionCode: z.string().optional()
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/register', asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, config.BCRYPT_ROUNDS);
  const result = await withTransaction(async (client) => {
    const business = await query(
      `INSERT INTO businesses (name, timezone, jurisdiction_code, pricing_mode, next_invoice_number)
       VALUES ($1, $2, $3, 'tax_exclusive', 1)
       RETURNING id, name, timezone, jurisdiction_code`,
      [body.businessName, body.timezone, body.jurisdictionCode ?? null],
      client
    );
    const user = await query<{ id: string; business_id: string; email: string; role: string; name: string | null }>(
      `INSERT INTO users (business_id, email, password_hash, role, name, phone)
       VALUES ($1, lower($2), $3, 'owner', $4, $5)
       RETURNING id, business_id, email, role, name`,
      [business.rows[0].id, body.email, passwordHash, body.ownerName ?? null, body.phone ?? null],
      client
    );
    return { business: business.rows[0], user: user.rows[0] };
  });
  const token = signAccessToken({ id: result.user.id, businessId: result.user.business_id, role: result.user.role, email: result.user.email });
  res.status(201).json({ ...result, token });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const result = await query<{ id: string; business_id: string; email: string; password_hash: string; role: string; name: string | null }>(
    `SELECT id, business_id, email, password_hash, role, name FROM users WHERE email = lower($1) AND deleted_at IS NULL`,
    [body.email]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  const token = signAccessToken({ id: user.id, businessId: user.business_id, role: user.role, email: user.email });
  res.json({ token, user: { id: user.id, businessId: user.business_id, email: user.email, role: user.role, name: user.name } });
}));

router.get('/me', authenticateJwt, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.business_id AS "businessId", u.email, u.role, u.name, b.name AS "businessName"
       FROM users u JOIN businesses b ON b.id = u.business_id WHERE u.id = $1`,
    [req.user!.id]
  );
  if (result.rowCount === 0) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  res.json({ user: result.rows[0] });
}));

export default router;
