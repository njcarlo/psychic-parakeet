export const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function currency(cents?: number | null, currencyCode = 'NZD'): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2
  }).format(value);
}

export function dateTime(value?: string | null): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function dateOnly(value?: string | null): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(new Date(value));
}

export function timeOnly(value?: string | null): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-NZ', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function toDateTimeLocal(value?: string | Date): string {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function isoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

export function titleize(value?: string | null): string {
  if (!value) return 'Unknown';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function propertyName(property: { name?: string; label?: string } | undefined): string {
  return property?.name ?? property?.label ?? 'Property';
}

export function shortId(value?: string | null): string {
  return value ? value.slice(0, 8) : 'Not set';
}

export function startOfTodayIso(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function endOfTodayIso(): string {
  const date = new Date();
  date.setHours(24, 0, 0, 0);
  return date.toISOString();
}
