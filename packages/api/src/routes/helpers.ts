import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { query } from '../lib/db.js';
import type { DbExecutor } from '../lib/db.js';

export const idParamSchema = z.object({ id: z.string().uuid() });
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export function getBusinessId(req: { businessId?: string; user?: { businessId?: string } }): string {
  const businessId = req.businessId ?? req.user?.businessId;
  if (!businessId) {
    throw new AppError(401, 'Business context is required', 'BUSINESS_CONTEXT_REQUIRED');
  }
  return businessId;
}

export function db(req: { dbClient?: DbExecutor }): DbExecutor | undefined {
  return req.dbClient;
}

export async function ensureOwned(table: string, id: string, businessId: string, client?: DbExecutor): Promise<void> {
  const result = await query(`SELECT id FROM ${table} WHERE id = $1 AND business_id = $2`, [id, businessId], client);
  if (result.rowCount === 0) {
    throw new AppError(404, 'Resource not found', 'NOT_FOUND');
  }
}

export function buildPatch<T extends Record<string, unknown>>(data: T, allowed: Array<keyof T>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      values.push(data[key]);
      fields.push(`${String(key)} = $${values.length}`);
    }
  }
  if (fields.length === 0) {
    throw new AppError(400, 'No fields provided', 'NO_FIELDS');
  }
  return { fields, values };
}
