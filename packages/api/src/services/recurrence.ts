import { addDays, addMonths, dateKey, normalizeDateOnly } from './time.js';
import { query, withBusinessContext } from '../lib/db.js';
import type { DbExecutor } from '../lib/db.js';
import { config } from '../lib/config.js';

export type RecurrenceFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'custom';

export interface RecurrenceRule {
  id: string;
  business_id: string;
  client_id: string;
  property_id: string;
  frequency: RecurrenceFrequency;
  interval_weeks: number;
  starts_on: string | Date;
  ends_on?: string | Date | null;
  day_of_week?: number | null;
  preferred_start_time?: string | null;
  duration_minutes: number;
  cleaner_id?: string | null;
  checklist_template_id?: string | null;
  price_cents: number;
  active: boolean;
  last_generated_until?: string | Date | null;
  notes?: string | null;
}

export function nextOccurrenceDate(current: Date, frequency: RecurrenceFrequency, interval = 1): Date {
  if (frequency === 'weekly') return addDays(current, 7 * interval);
  if (frequency === 'fortnightly') return addDays(current, 14 * interval);
  if (frequency === 'custom') return addDays(current, 7 * interval);
  return addMonths(current, interval);
}

export function generateOccurrenceDates(rule: Pick<RecurrenceRule, 'frequency' | 'starts_on' | 'ends_on' | 'last_generated_until' | 'interval_weeks'>, horizonUntil: Date): Date[] {
  const interval = Math.max(1, rule.interval_weeks ?? 1);
  const start = normalizeDateOnly(rule.starts_on);
  const end = rule.ends_on ? normalizeDateOnly(rule.ends_on) : undefined;
  const generatedUntil = rule.last_generated_until ? normalizeDateOnly(rule.last_generated_until) : undefined;
  const lowerBound = generatedUntil ? addDays(generatedUntil, 1) : start;

  const dates: Date[] = [];
  let cursor = start;
  while (cursor <= horizonUntil) {
    if (cursor >= lowerBound && (!end || cursor <= end)) {
      dates.push(new Date(cursor));
    }
    cursor = nextOccurrenceDate(cursor, rule.frequency, interval);
  }
  return dates;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hours = '0', minutes = '0', seconds = '0'] = time.split(':');
  const combined = new Date(date);
  combined.setHours(Number(hours), Number(minutes), Number(seconds), 0);
  return combined;
}

export async function generateJobsForRule(ruleId: string, businessId: string, horizonWeeks = config.RECURRENCE_HORIZON_WEEKS): Promise<number> {
  return withBusinessContext(businessId, async (client) => {
    const rules = await query<RecurrenceRule>('SELECT * FROM recurrence_rules WHERE id = $1 AND business_id = $2 AND active = true', [ruleId, businessId], client);
    const rule = rules.rows[0];
    if (!rule) return 0;

    const horizonUntil = addDays(normalizeDateOnly(new Date()), horizonWeeks * 7);
    const dates = generateOccurrenceDates(rule, horizonUntil);
    let created = 0;

    for (const occurrenceDate of dates) {
      const scheduledStart = combineDateAndTime(occurrenceDate, rule.preferred_start_time ?? '09:00');
      const scheduledEnd = new Date(scheduledStart.getTime() + rule.duration_minutes * 60_000);
      const inserted = await query(
        `INSERT INTO jobs (business_id, client_id, property_id, recurrence_rule_id, scheduled_start, scheduled_end, status, price_cents, notes)
         VALUES ($1,$2,$3,$4,$5,$6,'scheduled',$7,$8)
         ON CONFLICT (business_id, recurrence_rule_id, scheduled_start)
           WHERE recurrence_rule_id IS NOT NULL
           DO NOTHING
         RETURNING id`,
        [businessId, rule.client_id, rule.property_id, rule.id, scheduledStart, scheduledEnd, rule.price_cents, rule.notes ?? null],
        client
      );
      created += inserted.rowCount ?? 0;
      const jobId = inserted.rows[0]?.id as string | undefined;
      if (jobId && rule.cleaner_id) {
        await query(
          `INSERT INTO job_assignments (business_id, job_id, user_id)
           VALUES ($1,$2,$3)
           ON CONFLICT (job_id, user_id) DO NOTHING`,
          [businessId, jobId, rule.cleaner_id],
          client
        );
      }
    }

    await query(
      'UPDATE recurrence_rules SET last_generated_until = GREATEST(COALESCE(last_generated_until, $1::date), $1::date), updated_at = now() WHERE id = $2 AND business_id = $3',
      [dateKey(horizonUntil), rule.id, businessId],
      client
    );
    return created;
  });
}

export async function generateDueRecurringJobs(executor?: DbExecutor): Promise<number> {
  const rules = await query<{ id: string; business_id: string }>(
    `SELECT id, business_id FROM recurrence_rules
      WHERE active = true
        AND (last_generated_until IS NULL OR last_generated_until < (current_date + ($1::int * interval '1 week')))`,
    [config.RECURRENCE_HORIZON_WEEKS],
    executor
  );
  let total = 0;
  for (const rule of rules.rows) {
    total += await generateJobsForRule(rule.id, rule.business_id);
  }
  return total;
}
