import { addDays, addMonths, dateKey, normalizeDateOnly } from './time.js';
import { query, withBusinessContext } from '../lib/db.js';
import type { DbExecutor } from '../lib/db.js';
import { config } from '../lib/config.js';

export type RecurrenceFrequency = 'weekly' | 'fortnightly' | 'monthly';

export interface RecurrenceRule {
  id: string;
  business_id: string;
  client_id: string;
  property_id: string;
  frequency: RecurrenceFrequency;
  interval?: number | null;
  start_date: string | Date;
  end_date?: string | Date | null;
  day_of_week?: number | null;
  day_of_month?: number | null;
  scheduled_time: string;
  duration_minutes: number;
  price_cents?: number | null;
  currency?: string | null;
  active: boolean;
  last_generated_until?: string | Date | null;
}

export function nextOccurrenceDate(current: Date, frequency: RecurrenceFrequency, interval = 1): Date {
  if (frequency === 'weekly') return addDays(current, 7 * interval);
  if (frequency === 'fortnightly') return addDays(current, 14 * interval);
  return addMonths(current, interval);
}

export function generateOccurrenceDates(rule: Pick<RecurrenceRule, 'frequency' | 'start_date' | 'end_date' | 'last_generated_until' | 'interval'>, horizonUntil: Date): Date[] {
  const interval = Math.max(1, rule.interval ?? 1);
  const start = normalizeDateOnly(rule.start_date);
  const end = rule.end_date ? normalizeDateOnly(rule.end_date) : undefined;
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
      const scheduledStart = combineDateAndTime(occurrenceDate, rule.scheduled_time);
      const scheduledEnd = new Date(scheduledStart.getTime() + rule.duration_minutes * 60_000);
      const inserted = await query(
        `INSERT INTO jobs (business_id, client_id, property_id, recurrence_rule_id, scheduled_start, scheduled_end, status, price_cents, currency)
         VALUES ($1,$2,$3,$4,$5,$6,'scheduled',$7,$8)
         ON CONFLICT (business_id, recurrence_rule_id, scheduled_start) DO NOTHING
         RETURNING id`,
        [businessId, rule.client_id, rule.property_id, rule.id, scheduledStart, scheduledEnd, rule.price_cents ?? null, rule.currency ?? 'NZD'],
        client
      );
      created += inserted.rowCount ?? 0;
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
