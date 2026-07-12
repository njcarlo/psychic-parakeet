CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_recurrence_start
  ON jobs (business_id, recurrence_rule_id, scheduled_start)
  WHERE recurrence_rule_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment
  ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
