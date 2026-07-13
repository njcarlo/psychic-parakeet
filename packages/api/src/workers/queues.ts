import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../lib/config.js';

export interface RecurrenceGenerateJob {
  ruleId?: string;
  businessId?: string;
}

export interface ReminderSendJob {
  businessId: string;
  jobId: string;
  reminderType: 'client' | 'cleaner';
}

export interface WebhookRetryJob {
  provider: 'stripe' | 'windcave' | 'paymongo';
  payload: unknown;
  attempts: number;
}

type LazyQueueOptions = {
  failFast?: boolean;
};

let recurrenceGenerateQueue: Queue<RecurrenceGenerateJob, unknown, string> | undefined;
let reminderSendQueue: Queue<ReminderSendJob, unknown, string> | undefined;
let webhookRetryQueue: Queue<WebhookRetryJob, unknown, string> | undefined;
let recurrenceGenerateEvents: QueueEvents | undefined;
let reminderSendEvents: QueueEvents | undefined;
let webhookRetryEvents: QueueEvents | undefined;

export function bullMqConnectionOptions(options: LazyQueueOptions = {}) {
  const url = new URL(config.REDIS_URL);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    connectTimeout: options.failFast ? 1_000 : undefined,
    maxRetriesPerRequest: options.failFast ? 1 : null,
    retryStrategy: options.failFast ? () => null : undefined
  };
}

export function getRecurrenceGenerateQueue(options: LazyQueueOptions = {}) {
  recurrenceGenerateQueue ??= new Queue<RecurrenceGenerateJob, unknown, string>('recurrence-generate', {
    connection: bullMqConnectionOptions(options)
  });
  return recurrenceGenerateQueue;
}

export function getReminderSendQueue(options: LazyQueueOptions = {}) {
  reminderSendQueue ??= new Queue<ReminderSendJob, unknown, string>('reminder-send', {
    connection: bullMqConnectionOptions(options)
  });
  return reminderSendQueue;
}

export function getWebhookRetryQueue(options: LazyQueueOptions = {}) {
  webhookRetryQueue ??= new Queue<WebhookRetryJob, unknown, string>('webhook-retry', {
    connection: bullMqConnectionOptions(options)
  });
  return webhookRetryQueue;
}

export function getRecurrenceGenerateEvents() {
  recurrenceGenerateEvents ??= new QueueEvents('recurrence-generate', { connection: bullMqConnectionOptions() });
  return recurrenceGenerateEvents;
}

export function getReminderSendEvents() {
  reminderSendEvents ??= new QueueEvents('reminder-send', { connection: bullMqConnectionOptions() });
  return reminderSendEvents;
}

export function getWebhookRetryEvents() {
  webhookRetryEvents ??= new QueueEvents('webhook-retry', { connection: bullMqConnectionOptions() });
  return webhookRetryEvents;
}

async function isRedisAvailable(): Promise<boolean> {
  let redis: Redis | undefined;

  try {
    redis = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 1_000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      retryStrategy: () => null
    });
    redis.on('error', () => undefined);
    await redis.connect();
    await redis.ping();
    return true;
  } catch {
    return false;
  } finally {
    if (redis) {
      try {
        await redis.quit();
      } catch {
        redis.disconnect();
      }
    }
  }
}

export async function enqueueRecurrenceGenerate(data: RecurrenceGenerateJob): Promise<void> {
  if (config.MVP_MODE) {
    // eslint-disable-next-line no-console
    console.warn('MVP_MODE enabled; skipped recurrence generation enqueue.');
    return;
  }

  if (!(await isRedisAvailable())) {
    // eslint-disable-next-line no-console
    console.warn('Redis unavailable; skipped recurrence generation enqueue.');
    return;
  }

  try {
    const queue = getRecurrenceGenerateQueue({ failFast: true });
    const jobName = data.ruleId ? 'generate-rule' : 'generate-due';
    const jobId = data.ruleId && data.businessId ? `recurrence:${data.businessId}:${data.ruleId}` : undefined;
    await queue.add(jobName, data, jobId ? { jobId } : undefined);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to enqueue recurrence generation; continuing without Redis.', error);
  }
}
