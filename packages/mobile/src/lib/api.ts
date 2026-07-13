import { postOrQueue } from './offline';
import type {
  CachedJob,
  ChecklistItem,
  ChecklistResult,
  ClientRow,
  EarningsSummary,
  JobRow,
  PropertyRow,
  UserSession
} from './types';

const SESSION_KEY = 'cleanops_mobile_session';

interface ApiList<T> {
  data: T[];
}

interface ApiData<T> {
  data: T;
}

export function loadSession(): UserSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: UserSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function localDateKey(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayAndTomorrowKeys(): [string, string] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return [localDateKey(today), localDateKey(tomorrow)];
}

async function apiJson<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  const response = await fetch(`/api${path}`, { ...init, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function login(email: string, password: string): Promise<UserSession> {
  return apiJson<UserSession>('/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

function dateRangeForSchedule(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 2);
  return { start: start.toISOString(), end: end.toISOString() };
}

function addressFor(property: PropertyRow | undefined): string {
  if (!property) return 'Address unavailable';
  return [
    property.address_line1,
    property.address_line2,
    property.city,
    property.region,
    property.postal_code ?? property.postcode
  ].filter(Boolean).join(', ');
}

function safeProperty(raw: PropertyRow | undefined): PropertyRow | undefined {
  if (!raw) return undefined;
  const { access_notes: _accessNotes, ...property } = raw as PropertyRow & { access_notes?: string | null };
  return property;
}

function hydrateJobs(jobs: JobRow[], clients: ClientRow[], properties: PropertyRow[]): CachedJob[] {
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const propertiesById = new Map(properties.map((property) => [property.id, safeProperty(property)]));
  return jobs.map((job) => {
    const client = clientsById.get(job.client_id);
    const property = propertiesById.get(job.property_id);
    return {
      ...job,
      date_key: localDateKey(job.scheduled_start),
      client_name: client?.name ?? 'Client unavailable',
      address: addressFor(property),
      client,
      property
    };
  });
}

async function fetchDirectory(token: string): Promise<{ clients: ClientRow[]; properties: PropertyRow[] }> {
  const [clients, properties] = await Promise.all([
    apiJson<ApiList<ClientRow>>('/clients?limit=100', token),
    apiJson<ApiList<PropertyRow>>('/properties?limit=100', token)
  ]);
  return { clients: clients.data, properties: properties.data };
}

export async function fetchSchedule(token: string, cleanerId?: string): Promise<CachedJob[]> {
  const range = dateRangeForSchedule();
  const params = new URLSearchParams({ start: range.start, end: range.end, limit: '100' });
  if (cleanerId) params.set('cleanerId', cleanerId);

  let jobs: ApiList<JobRow>;
  try {
    jobs = await apiJson<ApiList<JobRow>>(`/jobs?${params.toString()}`, token);
  } catch (error) {
    if (!cleanerId) throw error;
    params.delete('cleanerId');
    jobs = await apiJson<ApiList<JobRow>>(`/jobs?${params.toString()}`, token);
  }

  const directory = await fetchDirectory(token);
  return hydrateJobs(jobs.data, directory.clients, directory.properties);
}

export async function fetchJob(token: string, jobId: string): Promise<CachedJob> {
  const [job, directory] = await Promise.all([
    apiJson<ApiData<JobRow>>(`/jobs/${jobId}`, token),
    fetchDirectory(token)
  ]);
  return hydrateJobs([job.data], directory.clients, directory.properties)[0];
}

export async function fetchChecklist(token: string, jobId: string): Promise<{ items: ChecklistItem[]; results: ChecklistResult[] }> {
  try {
    const response = await apiJson<ApiData<{ items: ChecklistItem[]; results: ChecklistResult[] }>>(`/checklists/jobs/${jobId}`, token);
    return response.data;
  } catch {
    return { items: [], results: [] };
  }
}

export async function fetchAccessNotes(token: string, propertyId: string): Promise<string | null> {
  const response = await apiJson<{ property_id: string; access_notes: string | null }>(`/properties/${propertyId}/access-notes`, token);
  return response.access_notes;
}

export async function clockIn(token: string, jobId: string, coords: GeolocationCoordinates | null) {
  return postOrQueue<ApiData<unknown>>('clock-in', '/api/time-entries/clock-in', {
    job_id: jobId,
    lat: coords?.latitude,
    lng: coords?.longitude
  }, token);
}

export async function clockOut(token: string, jobId: string, coords: GeolocationCoordinates | null) {
  return postOrQueue<ApiData<unknown>>('clock-out', '/api/time-entries/clock-out', {
    job_id: jobId,
    lat: coords?.latitude,
    lng: coords?.longitude
  }, token);
}

export async function submitChecklistResult(
  token: string,
  body: { job_id: string; checklist_item_id: string; completed: boolean; photo_url?: string }
) {
  return postOrQueue<ApiData<ChecklistResult>>('checklist', '/api/checklists/results', body, token);
}

export async function triggerSos(
  token: string,
  body: { job_id?: string; latitude?: number; longitude?: number; message?: string }
) {
  return postOrQueue<ApiData<unknown>>('sos', '/api/sos/trigger', {
    job_id: body.job_id,
    lat: body.latitude,
    lng: body.longitude,
    notes: body.message
  }, token);
}

export async function submitAvailability(
  token: string,
  rows: Array<{ day_of_week: number; start_time: string; end_time: string }>
): Promise<void> {
  await Promise.all(rows.map((row) => apiJson('/availability', token, {
    method: 'POST',
    body: JSON.stringify(row)
  })));
}

export async function submitTimeOff(
  token: string,
  body: { start_at: string; end_at: string; reason?: string }
): Promise<void> {
  await apiJson('/availability/time-off', token, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function fetchEarnings(token: string, start: string, end: string): Promise<EarningsSummary> {
  const params = new URLSearchParams({ start, end });
  const response = await apiJson<ApiData<EarningsSummary>>(`/earnings?${params.toString()}`, token);
  return response.data;
}
