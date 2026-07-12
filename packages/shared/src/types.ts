import type {
  COMM_PREFERENCES,
  INVOICE_STATUSES,
  JOB_STATUSES,
  MESSAGE_CHANNELS,
  MESSAGE_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  PAY_TYPES,
  PRICING_MODES,
  PROPERTY_ACCESS_ACTIONS,
  RECURRENCE_FREQUENCIES,
  ROLES,
  TIME_OFF_STATUSES,
} from './constants.js';

export type Uuid = string;
export type IsoDate = string;
export type IsoTimestamp = string;
export type TimeString = string;
export type CountryCode = 'NZ' | 'PH' | (string & {});
export type CurrencyCode = 'NZD' | 'PHP' | (string & {});

export type Role = (typeof ROLES)[number];
export type PayType = (typeof PAY_TYPES)[number];
export type PricingMode = (typeof PRICING_MODES)[number];
export type CommPreference = (typeof COMM_PREFERENCES)[number];
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type TimeOffStatus = (typeof TIME_OFF_STATUSES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
export type PropertyAccessAction = (typeof PROPERTY_ACCESS_ACTIONS)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface Business {
  id: Uuid;
  name: string;
  country_code: CountryCode;
  timezone: string;
  currency: CurrencyCode;
  pricing_mode: PricingMode;
  bir_permit_number: string | null;
  atp_number: string | null;
  next_invoice_number: number;
  stripe_account_id: string | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface User {
  id: Uuid;
  business_id: Uuid;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  phone: string | null;
  pay_type: PayType | null;
  pay_rate_cents: number | null;
  active: boolean;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface CleanerAvailability {
  id: Uuid;
  business_id: Uuid;
  user_id: Uuid;
  day_of_week: number;
  start_time: TimeString;
  end_time: TimeString;
}

export interface CleanerTimeOff {
  id: Uuid;
  business_id: Uuid;
  user_id: Uuid;
  starts_at: IsoTimestamp;
  ends_at: IsoTimestamp;
  reason: string | null;
  status: TimeOffStatus;
  reviewed_by: Uuid | null;
  reviewed_at: IsoTimestamp | null;
}

export interface Client {
  id: Uuid;
  business_id: Uuid;
  name: string;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  comm_preference: CommPreference;
  notes: string | null;
  active: boolean;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface Property {
  id: Uuid;
  business_id: Uuid;
  client_id: Uuid;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string | null;
  postcode: string | null;
  country_code: CountryCode;
  lat: number | null;
  lng: number | null;
  access_notes: string | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface PropertyAccessLog {
  id: Uuid;
  business_id: Uuid;
  property_id: Uuid;
  user_id: Uuid;
  accessed_at: IsoTimestamp;
  action: PropertyAccessAction;
}

export interface RecurrenceRule {
  id: Uuid;
  business_id: Uuid;
  client_id: Uuid;
  property_id: Uuid;
  frequency: RecurrenceFrequency;
  interval_weeks: number;
  day_of_week: number | null;
  preferred_start_time: TimeString | null;
  duration_minutes: number;
  cleaner_id: Uuid | null;
  checklist_template_id: Uuid | null;
  price_cents: number;
  active: boolean;
  starts_on: IsoDate;
  ends_on: IsoDate | null;
  last_generated_until: IsoDate | null;
  notes: string | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface Job {
  id: Uuid;
  business_id: Uuid;
  client_id: Uuid;
  property_id: Uuid;
  recurrence_rule_id: Uuid | null;
  scheduled_start: IsoTimestamp;
  scheduled_end: IsoTimestamp;
  status: JobStatus;
  price_cents: number;
  notes: string | null;
  client_generated_id: string | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface JobAssignment {
  id: Uuid;
  business_id: Uuid;
  job_id: Uuid;
  user_id: Uuid;
}

export interface TimeEntry {
  id: Uuid;
  business_id: Uuid;
  job_id: Uuid;
  user_id: Uuid;
  clock_in_at: IsoTimestamp;
  clock_out_at: IsoTimestamp | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  gps_missing: boolean;
  mileage_km: number | null;
  client_generated_id: string | null;
  created_at: IsoTimestamp;
}

export interface ChecklistTemplate {
  id: Uuid;
  business_id: Uuid;
  name: string;
  job_type: string | null;
  created_at: IsoTimestamp;
}

export interface ChecklistItem {
  id: Uuid;
  template_id: Uuid;
  business_id: Uuid;
  label: string;
  sort_order: number;
  requires_photo: boolean;
}

export interface JobChecklistResult {
  id: Uuid;
  business_id: Uuid;
  job_id: Uuid;
  checklist_item_id: Uuid;
  completed: boolean;
  completed_at: IsoTimestamp | null;
  completed_by: Uuid | null;
  photo_url: string | null;
  client_generated_id: string | null;
}

export interface TaxJurisdiction {
  id: Uuid;
  country_code: CountryCode;
  name: string;
  tax_name: string;
  rate_bps: number;
  inclusive_label: string;
  exclusive_label: string;
  active: boolean;
}

export interface Invoice {
  id: Uuid;
  business_id: Uuid;
  client_id: Uuid;
  invoice_number: number;
  invoice_number_display: string;
  status: InvoiceStatus;
  currency: CurrencyCode;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  pricing_mode: PricingMode;
  tax_jurisdiction_id: Uuid;
  issued_at: IsoTimestamp | null;
  due_at: IsoTimestamp | null;
  paid_at: IsoTimestamp | null;
  pdf_url: string | null;
  bir_permit_number: string | null;
  atp_number: string | null;
  notes: string | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface InvoiceLineItem {
  id: Uuid;
  business_id: Uuid;
  invoice_id: Uuid;
  job_id: Uuid | null;
  description: string;
  quantity: number;
  unit_price_cents: number;
  tax_cents: number;
  line_total_cents: number;
  sort_order: number;
}

export interface Payment {
  id: Uuid;
  business_id: Uuid;
  invoice_id: Uuid;
  provider: PaymentProvider;
  provider_payment_id: string | null;
  amount_cents: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  raw_event: JsonValue;
  confirmed_by: Uuid | null;
  confirmed_at: IsoTimestamp | null;
  created_at: IsoTimestamp;
}

export interface MessageTemplate {
  id: Uuid;
  business_id: Uuid;
  name: string;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  event_type: string;
}

export interface MessageLog {
  id: Uuid;
  business_id: Uuid;
  client_id: Uuid | null;
  channel: MessageChannel;
  to_address: string;
  subject: string | null;
  body: string;
  status: MessageStatus;
  provider_message_id: string | null;
  error: string | null;
  sent_at: IsoTimestamp | null;
  created_at: IsoTimestamp;
}

export interface SosAlert {
  id: Uuid;
  business_id: Uuid;
  user_id: Uuid;
  job_id: Uuid | null;
  triggered_at: IsoTimestamp;
  lat: number | null;
  lng: number | null;
  resolved_at: IsoTimestamp | null;
  resolved_by: Uuid | null;
  notes: string | null;
}

export interface ApiKey {
  id: Uuid;
  business_id: Uuid;
  name: string;
  key_hash: string;
  key_prefix: string;
  last_used_at: IsoTimestamp | null;
  revoked_at: IsoTimestamp | null;
  created_by: Uuid;
  created_at: IsoTimestamp;
}

export interface WebhookEndpoint {
  id: Uuid;
  business_id: Uuid;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  created_at: IsoTimestamp;
}

export interface WebhookDelivery {
  id: Uuid;
  business_id: Uuid;
  endpoint_id: Uuid;
  event_type: string;
  payload: JsonValue;
  status: string;
  attempts: number;
  last_error: string | null;
  delivered_at: IsoTimestamp | null;
  created_at: IsoTimestamp;
}

export interface NormalizedPaymentEvent {
  event_id: string;
  event_type: string;
  provider: PaymentProvider;
  provider_payment_id: string | null;
  business_id: Uuid | null;
  invoice_id: Uuid | null;
  amount_cents: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  occurred_at: IsoTimestamp;
  raw_event: unknown;
}
