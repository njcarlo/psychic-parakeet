import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import { config } from '../lib/config.js';
import { pool, setBusinessContext } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import type { AuthenticatedPrincipal, AuthRole } from '../types/express.js';

interface TokenPayload extends JwtPayload {
  sub: string;
  businessId: string;
  role: AuthRole;
  email?: string;
}

export function signAccessToken(user: AuthenticatedPrincipal): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn']
  };
  return jwt.sign(
    {
      businessId: user.businessId,
      role: user.role,
      email: user.email
    },
    config.JWT_SECRET,
    options
  );
}

export const authenticateJwt = asyncHandler(async (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Missing Bearer token', 'AUTH_REQUIRED');
  }

  const token = header.slice('Bearer '.length).trim();
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
  }

  if (!payload.sub || !payload.businessId || !payload.role) {
    throw new AppError(401, 'Invalid token payload', 'INVALID_TOKEN_PAYLOAD');
  }

  req.user = {
    id: payload.sub,
    businessId: payload.businessId,
    role: payload.role,
    email: payload.email
  };
  req.businessId = payload.businessId;
  next();
});

export function requireRole(...roles: AuthRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required', 'AUTH_REQUIRED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }
    return next();
  };
}

export const authenticateApiKey = asyncHandler(async (req, _res, next) => {
  const apiKey = req.header('x-api-key');
  if (!apiKey) {
    throw new AppError(401, 'Missing X-Api-Key header', 'API_KEY_REQUIRED');
  }

  const prefix = apiKey.slice(0, 12);
  const result = await pool.query<{
    id: string;
    business_id: string;
    key_hash: string;
    revoked_at: Date | null;
  }>(
    `SELECT id, business_id, key_hash, revoked_at
       FROM api_keys
      WHERE key_prefix = $1 AND revoked_at IS NULL`,
    [prefix]
  );

  for (const row of result.rows) {
    if (await bcrypt.compare(apiKey, row.key_hash)) {
      await pool.query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [row.id]);
      req.user = {
        id: row.id,
        businessId: row.business_id,
        role: 'office_admin',
        apiKeyId: row.id
      };
      req.businessId = row.business_id;
      return next();
    }
  }

  throw new AppError(401, 'Invalid API key', 'INVALID_API_KEY');
});

export const tenancy = asyncHandler(async (req, _res, next) => {
  const businessId = req.user?.businessId ?? req.businessId;
  if (!businessId) {
    throw new AppError(401, 'Business context is required', 'BUSINESS_CONTEXT_REQUIRED');
  }

  const client = await pool.connect();
  let finished = false;
  const rollback = async () => {
    if (finished) return;
    finished = true;
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  };
  const commit = async () => {
    if (finished) return;
    finished = true;
    try {
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  };

  try {
    await client.query('BEGIN');
    await setBusinessContext(client, businessId);
    req.dbClient = client;
    req.businessId = businessId;
    req.res?.once('finish', () => {
      if (req.res && req.res.statusCode >= 400) void rollback();
      else void commit();
    });
    req.res?.once('close', () => void rollback());
    next();
  } catch (error) {
    await rollback();
    throw error;
  }
});
