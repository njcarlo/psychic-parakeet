import type { PoolClient } from 'pg';

export type AuthRole = 'owner' | 'office_admin' | 'cleaner';

export interface AuthenticatedPrincipal {
  id: string;
  businessId: string;
  role: AuthRole;
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
