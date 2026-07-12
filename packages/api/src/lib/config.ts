import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
  CORS_ORIGIN: z.string().default('*'),
  PUBLIC_API_RATE_LIMIT_POINTS: z.coerce.number().int().positive().default(120),
  PUBLIC_API_RATE_LIMIT_DURATION: z.coerce.number().int().positive().default(60),
  RECURRENCE_HORIZON_WEEKS: z.coerce.number().int().positive().default(10),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  WINDCAVE_WEBHOOK_SECRET: z.string().optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  POSTMARK_SERVER_TOKEN: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${formatted}`);
}

export const config = parsed.data;
export type Config = typeof config;
