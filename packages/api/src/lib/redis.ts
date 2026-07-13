import { Redis } from 'ioredis';
import type { Redis as RedisClient } from 'ioredis';
import { config } from './config.js';

let redis: RedisClient | undefined;

export function getRedis(): RedisClient {
  if (!redis) {
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
  }
  return redis;
}
