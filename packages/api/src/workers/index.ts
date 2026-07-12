import { Worker } from 'bullmq';
import { generateDueRecurringJobs, generateJobsForRule } from '../services/recurrence.js';
import { bullMqConnectionOptions, recurrenceGenerateQueue, type RecurrenceGenerateJob, type ReminderSendJob, type WebhookRetryJob } from './queues.js';

const connection = bullMqConnectionOptions();

const recurrenceWorker = new Worker<RecurrenceGenerateJob, unknown, string>(
  'recurrence-generate',
  async (job) => {
    if (job.data.ruleId && job.data.businessId) {
      return { created: await generateJobsForRule(job.data.ruleId, job.data.businessId) };
    }
    return { created: await generateDueRecurringJobs() };
  },
  { connection }
);

const reminderWorker = new Worker<ReminderSendJob, unknown, string>(
  'reminder-send',
  async (job) => {
    // Stub: load job/client/cleaner context and call comms service.
    return { sent: true, jobId: job.data.jobId, reminderType: job.data.reminderType };
  },
  { connection }
);

const webhookRetryWorker = new Worker<WebhookRetryJob, unknown, string>(
  'webhook-retry',
  async (job) => {
    // Stub: replay normalized provider payload to provider-specific handler.
    return { retried: true, provider: job.data.provider, attempts: job.data.attempts + 1 };
  },
  { connection }
);

await recurrenceGenerateQueue.add(
  'nightly-horizon-fill',
  {},
  { repeat: { pattern: '0 2 * * *' }, jobId: 'nightly-horizon-fill' }
);

for (const worker of [recurrenceWorker, reminderWorker, webhookRetryWorker]) {
  worker.on('failed', (job, error) => {
    // eslint-disable-next-line no-console
    console.error(`Worker job failed: ${job?.queueName}/${job?.id}`, error);
  });
}

// eslint-disable-next-line no-console
console.log('CleanOps workers started');
