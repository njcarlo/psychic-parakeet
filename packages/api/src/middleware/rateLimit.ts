import type { RequestHandler } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { config } from '../lib/config.js';
import { AppError } from '../lib/errors.js';

const limiter = new RateLimiterMemory({
  points: config.PUBLIC_API_RATE_LIMIT_POINTS,
  duration: config.PUBLIC_API_RATE_LIMIT_DURATION
});

export const publicApiRateLimit: RequestHandler = async (req, _res, next) => {
  const key = req.ip || req.header('x-forwarded-for') || 'unknown';
  try {
    await limiter.consume(key);
    next();
  } catch {
    next(new AppError(429, 'Too many requests', 'RATE_LIMITED'));
  }
};
