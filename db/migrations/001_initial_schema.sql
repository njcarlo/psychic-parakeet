CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_business_context(biz_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_business_id', biz_id::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'NZ',
  timezone TEXT NOT NULL DEFAULT 'Pacific/Auckland',
  currency CHAR(3) NOT NULL DEFAULT 'NZD',
  pricing_mode TEXT NOT NULL DEFAULT 'inclusive' CHECK (pricing_mode IN ('inclusive', 'exclusive')),
  bir_permit_number TEXT,
  atp_number TEXT,
  next_invoice_number INT NOT NULL DEFAULT 1 CHECK (next_invoice_number > 0),
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tax_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tax_name TEXT NOT NULL,
  rate_bps INT NOT NULL CHECK (rate_bps >= 0),
  inclusive_label TEXT NOT NULL,
  exclusive_label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'office_admin', 'cleaner')),
  phone TEXT,
  pay_type TEXT CHECK (pay_type IN ('hourly', 'per_job')),
  pay_rate_cents INT CHECK (pay_rate_cents IS NULL OR pay_rate_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  billing_address TEXT,
  comm_preference TEXT NOT NULL DEFAULT 'email' CHECK (comm_preference IN ('sms', 'email', 'both', 'none')),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  region TEXT,
  postcode TEXT,
  country_code CHAR(2) NOT NULL DEFAULT 'NZ',
  lat NUMERIC(9,6) CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  lng NUMERIC(9,6) CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  access_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE property_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL CHECK (action IN ('view', 'edit'))
);

CREATE TABLE cleaner_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (start_time < end_time)
);

CREATE TABLE cleaner_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  CHECK (starts_at < ends_at)
);

CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  requires_photo BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE recurrence_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'custom')),
  interval_weeks INT NOT NULL DEFAULT 1 CHECK (interval_weeks > 0),
  day_of_week INT CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  preferred_start_time TIME,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  cleaner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  starts_on DATE NOT NULL,
  ends_on DATE,
  last_generated_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on <= ends_on)
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  recurrence_rule_id UUID REFERENCES recurrence_rules(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'skipped')),
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  notes TEXT,
  client_generated_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, client_generated_id),
  CHECK (scheduled_start < scheduled_end)
);

CREATE TABLE job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (job_id, user_id)
);

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ,
  clock_in_lat NUMERIC(9,6) CHECK (clock_in_lat IS NULL OR (clock_in_lat >= -90 AND clock_in_lat <= 90)),
  clock_in_lng NUMERIC(9,6) CHECK (clock_in_lng IS NULL OR (clock_in_lng >= -180 AND clock_in_lng <= 180)),
  clock_out_lat NUMERIC(9,6) CHECK (clock_out_lat IS NULL OR (clock_out_lat >= -90 AND clock_out_lat <= 90)),
  clock_out_lng NUMERIC(9,6) CHECK (clock_out_lng IS NULL OR (clock_out_lng >= -180 AND clock_out_lng <= 180)),
  gps_missing BOOLEAN NOT NULL DEFAULT false,
  mileage_km NUMERIC(10,2) CHECK (mileage_km IS NULL OR mileage_km >= 0),
  client_generated_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (clock_out_at IS NULL OR clock_in_at <= clock_out_at)
);

CREATE TABLE job_checklist_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  photo_url TEXT,
  client_generated_id TEXT
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  invoice_number INT NOT NULL CHECK (invoice_number > 0),
  invoice_number_display TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void', 'overdue')),
  currency CHAR(3) NOT NULL,
  subtotal_cents INT NOT NULL CHECK (subtotal_cents >= 0),
  tax_cents INT NOT NULL CHECK (tax_cents >= 0),
  total_cents INT NOT NULL CHECK (total_cents >= 0),
  pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('inclusive', 'exclusive')),
  tax_jurisdiction_id UUID NOT NULL REFERENCES tax_jurisdictions(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  bir_permit_number TEXT,
  atp_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, invoice_number)
);

CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit_price_cents INT NOT NULL CHECK (unit_price_cents >= 0),
  tax_cents INT NOT NULL CHECK (tax_cents >= 0),
  line_total_cents INT NOT NULL CHECK (line_total_cents >= 0),
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'windcave', 'paymongo', 'manual_bank', 'poli')),
  provider_payment_id TEXT,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  raw_event JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  subject TEXT,
  body TEXT NOT NULL,
  event_type TEXT NOT NULL
);

CREATE TABLE message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  to_address TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  provider_message_id TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat NUMERIC(9,6) CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  lng NUMERIC(9,6) CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER businesses_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER properties_updated_at
BEFORE UPDATE ON properties
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER recurrence_rules_updated_at
BEFORE UPDATE ON recurrence_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER jobs_updated_at
BEFORE UPDATE ON jobs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_users_business_id ON users(business_id);
CREATE INDEX idx_users_role ON users(business_id, role);
CREATE INDEX idx_cleaner_availability_business_id ON cleaner_availability(business_id);
CREATE INDEX idx_cleaner_availability_user_id ON cleaner_availability(user_id);
CREATE INDEX idx_cleaner_time_off_business_id ON cleaner_time_off(business_id);
CREATE INDEX idx_cleaner_time_off_user_id ON cleaner_time_off(user_id);
CREATE INDEX idx_cleaner_time_off_status ON cleaner_time_off(business_id, status);
CREATE INDEX idx_cleaner_time_off_reviewed_by ON cleaner_time_off(reviewed_by);
CREATE INDEX idx_clients_business_id ON clients(business_id);
CREATE INDEX idx_clients_active ON clients(business_id, active);
CREATE INDEX idx_properties_business_id ON properties(business_id);
CREATE INDEX idx_properties_client_id ON properties(client_id);
CREATE INDEX idx_property_access_log_business_id ON property_access_log(business_id);
CREATE INDEX idx_property_access_log_property_id ON property_access_log(property_id);
CREATE INDEX idx_property_access_log_user_id ON property_access_log(user_id);
CREATE INDEX idx_recurrence_rules_business_id ON recurrence_rules(business_id);
CREATE INDEX idx_recurrence_rules_client_id ON recurrence_rules(client_id);
CREATE INDEX idx_recurrence_rules_property_id ON recurrence_rules(property_id);
CREATE INDEX idx_recurrence_rules_cleaner_id ON recurrence_rules(cleaner_id);
CREATE INDEX idx_recurrence_rules_checklist_template_id ON recurrence_rules(checklist_template_id);
CREATE INDEX idx_recurrence_rules_active ON recurrence_rules(business_id, active);
CREATE INDEX idx_jobs_business_id ON jobs(business_id);
CREATE INDEX idx_jobs_client_id ON jobs(client_id);
CREATE INDEX idx_jobs_property_id ON jobs(property_id);
CREATE INDEX idx_jobs_recurrence_rule_id ON jobs(recurrence_rule_id);
CREATE INDEX idx_jobs_scheduled_start ON jobs(business_id, scheduled_start);
CREATE INDEX idx_jobs_status ON jobs(business_id, status);
CREATE INDEX idx_job_assignments_business_id ON job_assignments(business_id);
CREATE INDEX idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX idx_job_assignments_user_id ON job_assignments(user_id);
CREATE INDEX idx_time_entries_business_id ON time_entries(business_id);
CREATE INDEX idx_time_entries_job_id ON time_entries(job_id);
CREATE INDEX idx_time_entries_user_id ON time_entries(user_id);
CREATE UNIQUE INDEX idx_time_entries_client_generated_id
  ON time_entries(business_id, client_generated_id)
  WHERE client_generated_id IS NOT NULL;
CREATE INDEX idx_checklist_templates_business_id ON checklist_templates(business_id);
CREATE INDEX idx_checklist_items_business_id ON checklist_items(business_id);
CREATE INDEX idx_checklist_items_template_id ON checklist_items(template_id);
CREATE INDEX idx_job_checklist_results_business_id ON job_checklist_results(business_id);
CREATE INDEX idx_job_checklist_results_job_id ON job_checklist_results(job_id);
CREATE INDEX idx_job_checklist_results_checklist_item_id ON job_checklist_results(checklist_item_id);
CREATE INDEX idx_job_checklist_results_completed_by ON job_checklist_results(completed_by);
CREATE UNIQUE INDEX idx_job_checklist_results_client_generated_id
  ON job_checklist_results(business_id, client_generated_id)
  WHERE client_generated_id IS NOT NULL;
CREATE UNIQUE INDEX idx_job_checklist_results_job_item
  ON job_checklist_results(job_id, checklist_item_id);
CREATE INDEX idx_invoices_business_id ON invoices(business_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(business_id, status);
CREATE INDEX idx_invoices_due_at ON invoices(business_id, due_at);
CREATE INDEX idx_invoices_tax_jurisdiction_id ON invoices(tax_jurisdiction_id);
CREATE INDEX idx_invoice_line_items_business_id ON invoice_line_items(business_id);
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_job_id ON invoice_line_items(job_id);
CREATE INDEX idx_payments_business_id ON payments(business_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_provider_payment_id ON payments(provider, provider_payment_id);
CREATE INDEX idx_payments_confirmed_by ON payments(confirmed_by);
CREATE INDEX idx_message_templates_business_id ON message_templates(business_id);
CREATE INDEX idx_message_templates_event_type ON message_templates(business_id, event_type);
CREATE INDEX idx_message_log_business_id ON message_log(business_id);
CREATE INDEX idx_message_log_client_id ON message_log(client_id);
CREATE INDEX idx_message_log_status ON message_log(business_id, status);
CREATE INDEX idx_sos_alerts_business_id ON sos_alerts(business_id);
CREATE INDEX idx_sos_alerts_user_id ON sos_alerts(user_id);
CREATE INDEX idx_sos_alerts_job_id ON sos_alerts(job_id);
CREATE INDEX idx_sos_alerts_resolved_by ON sos_alerts(resolved_by);
CREATE INDEX idx_api_keys_business_id ON api_keys(business_id);
CREATE INDEX idx_api_keys_created_by ON api_keys(created_by);
CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_webhook_endpoints_business_id ON webhook_endpoints(business_id);
CREATE INDEX idx_webhook_endpoints_active ON webhook_endpoints(business_id, active);
CREATE INDEX idx_webhook_deliveries_business_id ON webhook_deliveries(business_id);
CREATE INDEX idx_webhook_deliveries_endpoint_id ON webhook_deliveries(endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(business_id, status);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaner_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaner_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurrence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_checklist_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY businesses_business_context ON businesses
FOR ALL
USING (id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY users_business_context ON users
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY cleaner_availability_business_context ON cleaner_availability
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY cleaner_time_off_business_context ON cleaner_time_off
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY clients_business_context ON clients
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY properties_business_context ON properties
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY property_access_log_business_context ON property_access_log
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY recurrence_rules_business_context ON recurrence_rules
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY jobs_business_context ON jobs
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY job_assignments_business_context ON job_assignments
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY time_entries_business_context ON time_entries
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY checklist_templates_business_context ON checklist_templates
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY checklist_items_business_context ON checklist_items
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY job_checklist_results_business_context ON job_checklist_results
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY invoices_business_context ON invoices
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY invoice_line_items_business_context ON invoice_line_items
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY payments_business_context ON payments
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY message_templates_business_context ON message_templates
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY message_log_business_context ON message_log
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY sos_alerts_business_context ON sos_alerts
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY api_keys_business_context ON api_keys
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY webhook_endpoints_business_context ON webhook_endpoints
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

CREATE POLICY webhook_deliveries_business_context ON webhook_deliveries
FOR ALL
USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid)
WITH CHECK (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);

INSERT INTO tax_jurisdictions (
  country_code,
  name,
  tax_name,
  rate_bps,
  inclusive_label,
  exclusive_label,
  active
) VALUES
  ('NZ', 'New Zealand', 'GST', 1500, 'GST inclusive', '+ GST', true),
  ('PH', 'Philippines', 'VAT', 1200, 'VAT inclusive', '+ VAT', false)
ON CONFLICT (country_code) DO UPDATE SET
  name = EXCLUDED.name,
  tax_name = EXCLUDED.tax_name,
  rate_bps = EXCLUDED.rate_bps,
  inclusive_label = EXCLUDED.inclusive_label,
  exclusive_label = EXCLUDED.exclusive_label,
  active = EXCLUDED.active;
