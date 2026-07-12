import { Queue, QueueEvents } from 'bullmq';
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

export function bullMqConnectionOptions() {
  const url = new URL(config.REDIS_URL);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null
  };
}

const connection = bullMqConnectionOptions();

export const recurrenceGenerateQueue = new Queue<RecurrenceGenerateJob, unknown, string>('recurrence-generate', { connection });
export const reminderSendQueue = new Queue<ReminderSendJob, unknown, string>('reminder-send', { connection });
export const webhookRetryQueue = new Queue<WebhookRetryJob, unknown, string>('webhook-retry', { connection });

export const recurrenceGenerateEvents = new QueueEvents('recurrence-generate', { connection });
export const reminderSendEvents = new QueueEvents('reminder-send', { connection });
export const webhookRetryEvents = new QueueEvents('webhook-retry', { connection });
