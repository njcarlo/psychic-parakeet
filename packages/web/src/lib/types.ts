export type ApiList<T> = {
  data: T[];
  limit?: number;
  offset?: number;
};

export type ApiItem<T> = {
  data: T;
};

export type AuthUser = {
  id: string;
  businessId: string;
  business_id?: string;
  email: string;
  role: string;
  name?: string | null;
  full_name?: string | null;
  businessName?: string;
};

export type Client = {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  comm_preference: string;
  notes: string | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type Property = {
  id: string;
  business_id: string;
  client_id: string;
  name?: string;
  label?: string;
  address_line1: string;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  postcode?: string | null;
  country?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  access_notes?: string | null;
  service_notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type JobStatus =
  | 'scheduled'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'skipped';

export type Job = {
  id: string;
  business_id: string;
  client_id: string;
  property_id: string;
  recurrence_rule_id?: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: JobStatus;
  price_cents: number;
  currency?: string;
  notes?: string | null;
  client_generated_id?: string | null;
  created_at?: string;
  updated_at?: string;
  cleaner_ids?: string[];
  user_ids?: string[];
};

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void' | 'overdue';

export type Invoice = {
  id: string;
  business_id: string;
  client_id: string;
  invoice_number: number;
  invoice_number_display: string;
  status: InvoiceStatus;
  currency: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  pricing_mode?: string;
  tax_jurisdiction_id?: string;
  issued_at?: string | null;
  due_date?: string | null;
  due_at?: string | null;
  paid_at?: string | null;
  pdf_url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  lines?: InvoiceLine[];
};

export type InvoiceLine = {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  tax_cents: number;
  line_total_cents: number;
  job_id?: string | null;
};

export type Availability = {
  id: string;
  cleaner_id?: string;
  user_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type SosAlert = {
  id: string;
  user_id?: string;
  job_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  message?: string | null;
  notes?: string | null;
  status?: string;
  created_at?: string;
  triggered_at?: string;
};

export type TaxJurisdiction = {
  id?: string;
  code?: string;
  country_code?: string;
  name: string;
  tax_name?: string;
  rate_bps?: number;
  rate?: number;
  currency?: string;
  inclusive_label?: string;
  exclusive_label?: string;
  active?: boolean;
};

export type ChecklistTemplate = {
  id: string;
  name: string;
  description?: string | null;
  job_type?: string | null;
  created_at?: string;
};

export type DashboardStats = {
  todaysJobs: number;
  completedToday: number;
  openInvoices: number;
  openSos: number;
  overdueInvoices: number;
  overdueAmountCents: number;
};
