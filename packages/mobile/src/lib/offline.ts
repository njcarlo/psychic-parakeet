import { openDB, type DBSchema } from 'idb';
import type { CachedJob, QueueKind } from './types';

export interface PendingRequest {
  client_generated_id: string;
  kind: QueueKind;
  method: 'POST' | 'PATCH';
  url: string;
  body: Record<string, unknown>;
  created_at: number;
  attempts: number;
  last_error?: string;
}

interface CleanOpsMobileDb extends DBSchema {
  jobs: {
    key: string;
    value: CachedJob;
    indexes: { date_key: string };
  };
  pending: {
    key: string;
    value: PendingRequest;
    indexes: { created_at: number };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const dbPromise = openDB<CleanOpsMobileDb>('cleanops-mobile', 1, {
  upgrade(db) {
    const jobs = db.createObjectStore('jobs', { keyPath: 'id' });
    jobs.createIndex('date_key', 'date_key');
    const pending = db.createObjectStore('pending', { keyPath: 'client_generated_id' });
    pending.createIndex('created_at', 'created_at');
    db.createObjectStore('meta', { keyPath: 'key' });
  }
});

export function makeClientGeneratedId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function cacheJobs(jobs: CachedJob[]): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction(['jobs', 'meta'], 'readwrite');
  await Promise.all([
    ...jobs.map((job) => tx.objectStore('jobs').put(job)),
    tx.objectStore('meta').put({ key: 'jobs_cached_at', value: new Date().toISOString() }),
    tx.done
  ]);
}

export async function getCachedJobsForDates(dateKeys: string[]): Promise<CachedJob[]> {
  const db = await dbPromise;
  const jobs = await Promise.all(dateKeys.map((dateKey) => db.getAllFromIndex('jobs', 'date_key', dateKey)));
  return jobs.flat().sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
}

export async function getCachedJob(jobId: string): Promise<CachedJob | undefined> {
  const db = await dbPromise;
  return db.get('jobs', jobId);
}

export async function getQueueCount(): Promise<number> {
  const db = await dbPromise;
  return db.count('pending');
}

export async function getPendingRequests(): Promise<PendingRequest[]> {
  const db = await dbPromise;
  return db.getAllFromIndex('pending', 'created_at');
}

export async function queueRequest(
  kind: QueueKind,
  url: string,
  body: Record<string, unknown>,
  method: 'POST' | 'PATCH' = 'POST'
): Promise<PendingRequest> {
  const clientGeneratedId = typeof body.client_generated_id === 'string' ? body.client_generated_id : makeClientGeneratedId();
  const pending: PendingRequest = {
    client_generated_id: clientGeneratedId,
    kind,
    method,
    url,
    body: { ...body, client_generated_id: clientGeneratedId },
    created_at: Date.now(),
    attempts: 0
  };
  const db = await dbPromise;
  await db.put('pending', pending);
  return pending;
}

export async function postOrQueue<T>(
  kind: QueueKind,
  url: string,
  body: Record<string, unknown>,
  token: string
): Promise<T | { queued: true; client_generated_id: string }> {
  const bodyWithId = {
    ...body,
    client_generated_id: typeof body.client_generated_id === 'string' ? body.client_generated_id : makeClientGeneratedId()
  };

  if (!navigator.onLine) {
    const pending = await queueRequest(kind, url, bodyWithId);
    return { queued: true, client_generated_id: pending.client_generated_id };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(bodyWithId)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    const pending = await queueRequest(kind, url, bodyWithId);
    return { queued: true, client_generated_id: pending.client_generated_id };
  }
}

export async function syncQueue(token: string | null): Promise<number> {
  if (!token || !navigator.onLine) return getQueueCount();

  const db = await dbPromise;
  const pending = await getPendingRequests();
  for (const request of pending) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(request.body)
      });

      if (response.ok) {
        await db.delete('pending', request.client_generated_id);
        continue;
      }

      request.attempts += 1;
      request.last_error = `HTTP ${response.status}`;
      await db.put('pending', request);
      if (response.status === 401) break;
    } catch (error) {
      request.attempts += 1;
      request.last_error = error instanceof Error ? error.message : 'Network error';
      await db.put('pending', request);
      break;
    }
  }

  return getQueueCount();
}

export function installQueueSync(getToken: () => string | null, onSynced?: (pendingCount: number) => void): () => void {
  const run = () => {
    void syncQueue(getToken()).then((pendingCount) => onSynced?.(pendingCount));
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') run();
  };

  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisibility);
  run();

  return () => {
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

// Offline strategy: the app layer owns the IndexedDB cache and mutation queue.
// Vite's service worker caches the shell and job-list GETs, while clock events,
// checklist results, and SOS triggers are stored with client_generated_id and
// replayed on online/visibility-change so the UI can work without a network.
