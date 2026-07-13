import { describe, expect, it } from 'vitest';
import { generateOccurrenceDates } from '../src/services/recurrence.js';

describe('generateOccurrenceDates', () => {
  it('generates weekly occurrences inside the horizon without duplicates from last_generated_until', () => {
    const dates = generateOccurrenceDates(
      {
        frequency: 'weekly',
        starts_on: '2026-01-01',
        last_generated_until: '2026-01-08',
        interval_weeks: 1
      },
      new Date('2026-01-29')
    );

    expect(dates.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-01-15', '2026-01-22', '2026-01-29']);
  });

  it('rolls monthly dates to the last valid day of shorter months', () => {
    const dates = generateOccurrenceDates(
      {
        frequency: 'monthly',
        starts_on: '2026-01-31',
        interval_weeks: 1
      },
      new Date('2026-03-31')
    );

    expect(dates.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-01-31', '2026-02-28', '2026-03-28']);
  });
});
