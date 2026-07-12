import type { PoolClient } from 'pg';

export type AuthRole = 'owner' | 'admin' | 'office' | 'cleaner' | 'client';

export interface AuthenticatedPrincipal {
  id: string;
  businessId: string;
  role: AuthRole | string;
  email?: string;
  apiKeyId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedPrincipal;
      businessId?: string;
      dbClient?: PoolClient;
    }
  }
}

export {};
