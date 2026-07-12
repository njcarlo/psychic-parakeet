export const API_VERSION = 'v1';

export const RECURRENCE_HORIZON_WEEKS = 10;

export const ROLES = ['owner', 'office_admin', 'cleaner'] as const;

export const PAY_TYPES = ['hourly', 'per_job'] as const;

export const JOB_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'skipped'] as const;

export const COMM_PREFERENCES = ['sms', 'email', 'both', 'none'] as const;

export const PAYMENT_PROVIDERS = ['stripe', 'windcave', 'paymongo', 'manual_bank', 'poli'] as const;

export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'refunded'] as const;

export const PRICING_MODES = ['inclusive', 'exclusive'] as const;

export const RECURRENCE_FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'custom'] as const;

export const TIME_OFF_STATUSES = ['pending', 'approved', 'rejected'] as const;

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void', 'overdue'] as const;

export const MESSAGE_CHANNELS = ['sms', 'email'] as const;

export const MESSAGE_STATUSES = ['queued', 'sent', 'delivered', 'failed'] as const;

export const PROPERTY_ACCESS_ACTIONS = ['view', 'edit'] as const;
