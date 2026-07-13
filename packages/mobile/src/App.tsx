import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  clearSession,
  clockIn,
  clockOut,
  fetchAccessNotes,
  fetchChecklist,
  fetchEarnings,
  fetchJob,
  fetchSchedule,
  localDateKey,
  loadSession,
  login,
  registerDevicePushToken,
  saveSession,
  submitAvailability,
  submitChecklistResult,
  submitTimeOff,
  todayAndTomorrowKeys,
  triggerSos
} from './lib/api';
import { registerPushToken } from './lib/firebase';
import {
  cacheJobs,
  getCachedJob,
  getCachedJobsForDates,
  getQueueCount,
  installQueueSync,
  syncQueue
} from './lib/offline';
import { uploadChecklistPhoto } from './lib/photos';
import type { CachedJob, ChecklistItem, ChecklistResult, EarningsSummary, UserSession } from './lib/types';

type Navigate = (path: string) => void;

const ACTIVE_JOBS_KEY = 'cleanops_active_jobs';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const cleanerDemoEmail = 'mia@harbourshine.nz';
const demoPassword = 'password123';

function useRoute(): [string, Navigate] {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextPath: string) => {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };

  return [path, navigate];
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

function readActiveJobs(): Record<string, string> {
  const raw = localStorage.getItem(ACTIVE_JOBS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    localStorage.removeItem(ACTIVE_JOBS_KEY);
    return {};
  }
}

function writeActiveJob(jobId: string, active: boolean): Record<string, string> {
  const next = readActiveJobs();
  if (active) next[jobId] = new Date().toISOString();
  else delete next[jobId];
  localStorage.setItem(ACTIVE_JOBS_KEY, JSON.stringify(next));
  return next;
}

function isQueued(value: unknown): value is { queued: true; client_generated_id: string } {
  return Boolean(value && typeof value === 'object' && 'queued' in value);
}

function formatTimeWindow(job: CachedJob): string {
  const start = new Date(job.scheduled_start);
  const end = new Date(job.scheduled_end);
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  })}`;
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NZD' }).format(cents / 100);
}

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

function statusStyle(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'in_progress':
      return 'bg-amber-100 text-amber-800';
    case 'cancelled':
    case 'skipped':
    case 'no_show':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-teal-100 text-teal-800';
  }
}

function getCoordinates(): Promise<GeolocationCoordinates | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
    );
  });
}

function onlineCopy(online: boolean, pendingCount: number): string {
  if (!online) return pendingCount > 0 ? `Offline - ${pendingCount} queued` : 'Offline';
  return pendingCount > 0 ? `${pendingCount} syncing` : 'Online';
}

function AppShell({
  session,
  path,
  navigate,
  pendingCount,
  online,
  children,
  onLogout,
  onPendingChange
}: {
  session: UserSession;
  path: string;
  navigate: Navigate;
  pendingCount: number;
  online: boolean;
  children: ReactNode;
  onLogout: () => void;
  onPendingChange: () => void;
}) {
  const jobMatch = path.match(/^\/jobs\/(.+)$/);
  const currentJobId = jobMatch?.[1];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-5 text-slate-900">
      <header className="mb-5 flex items-center justify-between gap-3">
        <button className="text-left" onClick={() => navigate('/')}>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-teal-700">CleanOps</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Cleaner MVP</h1>
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/80 px-3 py-2 text-[11px] font-bold text-teal-800 shadow-sm">
            {onlineCopy(online, pendingCount)}
          </span>
          <button className="rounded-full bg-white/80 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4">
        <div className="glass-card mb-3 grid grid-cols-3 gap-1 rounded-[1.6rem] p-2">
          <NavItem active={path === '/'} label="Today" onClick={() => navigate('/')} />
          <NavItem active={path === '/earnings'} label="Earnings" onClick={() => navigate('/earnings')} />
          <NavItem active={path === '/availability'} label="Availability" onClick={() => navigate('/availability')} />
        </div>
      </nav>

      <SosButton
        session={session}
        jobId={currentJobId}
        onSynced={() => {
          void syncQueue(session.token).then(onPendingChange);
        }}
      />
    </div>
  );
}

function NavItem({ active, label, onClick, muted }: { active: boolean; label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button
      className={[
        'min-h-12 rounded-2xl text-xs font-extrabold transition',
        active ? 'bg-teal-700 text-white shadow-lg shadow-teal-700/20' : 'text-slate-600',
        muted ? 'opacity-40' : ''
      ].join(' ')}
      onClick={onClick}
      disabled={muted}
    >
      {label}
    </button>
  );
}

function LoginPage({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [email, setEmail] = useState(cleanerDemoEmail);
  const [password, setPassword] = useState(demoPassword);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const session = await login(email, password);
      saveSession(session);
      onLogin(session);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-8">
      <section className="glass-card rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-teal-700">CleanOps</p>
        <h1 className="mt-2 text-5xl font-black leading-tight text-slate-950">Cleaner MVP</h1>
        <p className="mt-3 text-base font-semibold leading-7 text-slate-700">
          Today&apos;s jobs, clock in/out, checklists, and audited access notes for the Harbour Shine demo.
        </p>
        <div className="mt-5 rounded-3xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">
          Demo: {cleanerDemoEmail} / {demoPassword}
        </div>

        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Email</span>
            <input className="soft-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Password</span>
            <input
              className="soft-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {status ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{status}</p> : null}
          <button className="teal-button w-full" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  );
}

function JobsPage({ session, navigate }: { session: UserSession; navigate: Navigate }) {
  const [jobs, setJobs] = useState<CachedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [todayKey, tomorrowKey] = todayAndTomorrowKeys();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const cached = await getCachedJobsForDates([todayKey, tomorrowKey]);
      if (alive && cached.length > 0) {
        setJobs(cached);
        setNotice('Showing cached jobs while refreshing.');
      }
      try {
        const fresh = await fetchSchedule(session.token, session.user.id);
        await cacheJobs(fresh);
        if (alive) {
          setJobs(fresh);
          setNotice(null);
        }
      } catch {
        if (alive) setNotice(cached.length > 0 ? 'Offline jobs are cached from your last refresh.' : 'No cached jobs yet. Connect once to load your schedule.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [session.token, session.user.id, todayKey, tomorrowKey]);

  const todaysJobs = jobs.filter((job) => job.date_key === todayKey);
  const tomorrowsJobs = jobs.filter((job) => job.date_key === tomorrowKey);

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-bold text-teal-700">{formatDateLabel(todayKey)}</p>
        <h2 className="text-3xl font-black tracking-tight text-slate-950">Today's jobs</h2>
      </div>
      {notice ? <p className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-teal-900">{notice}</p> : null}
      {loading && jobs.length === 0 ? <p className="rounded-3xl bg-white/70 p-5 text-sm font-semibold text-slate-600">Loading schedule...</p> : null}
      <JobList jobs={todaysJobs} empty="No jobs today - ask office to schedule you." navigate={navigate} />
      {tomorrowsJobs.length > 0 ? (
        <div className="pt-2">
          <h3 className="mb-3 text-xl font-black text-slate-900">Tomorrow</h3>
          <JobList jobs={tomorrowsJobs} empty="" navigate={navigate} />
        </div>
      ) : null}
    </section>
  );
}

function JobList({ jobs, empty, navigate }: { jobs: CachedJob[]; empty: string; navigate: Navigate }) {
  if (jobs.length === 0) return empty ? <p className="rounded-3xl bg-white/70 p-5 text-sm font-semibold text-slate-500">{empty}</p> : null;
  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <button key={job.id} className="glass-card w-full rounded-[1.6rem] p-4 text-left" onClick={() => navigate(`/jobs/${job.id}`)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-black leading-6 text-slate-950">{job.address}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500">{job.client_name}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${statusStyle(job.status)}`}>
              {statusLabel(job.status)}
            </span>
          </div>
          <p className="mt-4 text-sm font-extrabold text-teal-800">{formatTimeWindow(job)}</p>
        </button>
      ))}
    </div>
  );
}

function JobDetailPage({ session, jobId, onPendingChange }: { session: UserSession; jobId: string; onPendingChange: () => void }) {
  const [job, setJob] = useState<CachedJob | null>(null);
  const [activeJobs, setActiveJobs] = useState(readActiveJobs);
  const [accessNotes, setAccessNotes] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<{ items: ChecklistItem[]; results: ChecklistResult[] }>({ items: [], results: [] });
  const [photoByItem, setPhotoByItem] = useState<Record<string, File | undefined>>({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const clockedIn = Boolean(activeJobs[jobId]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const cached = await getCachedJob(jobId);
      if (alive && cached) setJob(cached);
      try {
        const fresh = await fetchJob(session.token, jobId);
        await cacheJobs([fresh]);
        if (alive) setJob(fresh);
      } catch {
        if (alive && !cached) setMessage('This job is not cached yet. Connect once to open it offline.');
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [jobId, session.token]);

  useEffect(() => {
    let alive = true;
    const loadChecklist = async () => {
      const next = await fetchChecklist(session.token, jobId);
      if (!alive) return;
      setChecklist(next);
      const done: Record<string, boolean> = {};
      for (const result of next.results) {
        if (result.completed) done[result.checklist_item_id] = true;
      }
      setCompleted(done);
    };
    void loadChecklist();
    return () => {
      alive = false;
    };
  }, [jobId, session.token]);

  const directionsUrl = useMemo(() => {
    const lat = job?.property?.latitude ?? job?.property?.lat;
    const lng = job?.property?.longitude ?? job?.property?.lng;
    if (lat != null && lng != null) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job?.address ?? '')}`;
  }, [job]);

  const handleClock = async () => {
    setMessage(clockedIn ? 'Clocking out...' : 'Clocking in...');
    const coords = await getCoordinates();
    try {
      const result = clockedIn ? await clockOut(session.token, jobId, coords) : await clockIn(session.token, jobId, coords);
      setActiveJobs(writeActiveJob(jobId, !clockedIn));
      setMessage(isQueued(result) ? `${clockedIn ? 'Clock-out' : 'Clock-in'} queued for sync.` : `${clockedIn ? 'Clocked out' : 'Clocked in'} successfully.`);
      onPendingChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Clock action failed.');
    }
  };

  const revealAccessNotes = async () => {
    if (!job?.property_id || !clockedIn) return;
    setMessage('Loading access notes...');
    try {
      const notes = await fetchAccessNotes(session.token, job.property_id);
      setAccessNotes(notes ?? 'No access notes recorded.');
      setMessage(null);
    } catch {
      setMessage('Access notes require a connection because viewing them is audited.');
    }
  };

  const completeItem = async (item: ChecklistItem) => {
    setMessage(`Saving ${item.label}...`);
    try {
      const file = photoByItem[item.id];
      const photoUrl = file ? await uploadChecklistPhoto(session.token, jobId, file) : undefined;
      const result = await submitChecklistResult(session.token, {
        job_id: jobId,
        checklist_item_id: item.id,
        completed: true,
        photo_url: photoUrl
      });
      setCompleted((current) => ({ ...current, [item.id]: true }));
      setMessage(isQueued(result) ? 'Checklist update queued.' : 'Checklist updated.');
      onPendingChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checklist update failed.');
    }
  };

  if (!job) {
    return <p className="rounded-3xl bg-white/70 p-5 text-sm font-semibold text-slate-600">{message ?? 'Loading job...'}</p>;
  }

  return (
    <section className="space-y-5">
      <div className="glass-card rounded-[1.8rem] p-5">
        <p className="text-sm font-extrabold text-teal-700">{formatTimeWindow(job)}</p>
        <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950">{job.address}</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">{job.client_name}</p>
        {job.notes ? <p className="mt-4 rounded-2xl bg-teal-50 p-3 text-sm font-semibold text-teal-900">{job.notes}</p> : null}
        <div className="mt-5 space-y-3">
          <button className="teal-button min-h-16 w-full text-base" onClick={handleClock}>
            {clockedIn ? 'Clock Out' : 'Clock In'}
          </button>
          <a className="flex min-h-13 items-center justify-center rounded-[1.25rem] bg-white text-sm font-black text-teal-800 shadow-sm" href={directionsUrl} target="_blank" rel="noreferrer">
            Directions
          </a>
        </div>
      </div>

      {message ? <p className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-teal-900">{message}</p> : null}

      <section className="glass-card rounded-[1.8rem] p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-black text-slate-950">Access notes</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase text-slate-500">Audited</span>
        </div>
        {!clockedIn ? (
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">Clock in first. Notes are only fetched and logged when you choose to view them.</p>
        ) : accessNotes ? (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">{accessNotes}</p>
        ) : (
          <button className="mt-4 min-h-12 w-full rounded-2xl bg-teal-50 text-sm font-black text-teal-800" onClick={revealAccessNotes}>
            Reveal access notes
          </button>
        )}
      </section>

      <section className="glass-card rounded-[1.8rem] p-5">
        <h3 className="text-xl font-black text-slate-950">Checklist</h3>
        {checklist.items.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-slate-500">No checklist assigned to this job yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {checklist.items.map((item) => (
              <div key={item.id} className="rounded-3xl bg-white/75 p-4">
                <button
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => {
                    if (!completed[item.id]) void completeItem(item);
                  }}
                >
                  <span
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black',
                      completed[item.id] ? 'border-teal-700 bg-teal-700 text-white' : 'border-teal-200 text-teal-700'
                    ].join(' ')}
                  >
                    {completed[item.id] ? '✓' : ''}
                  </span>
                  <span className="font-extrabold text-slate-900">{item.label}</span>
                </button>
                <label className="mt-3 block text-xs font-bold text-slate-500">
                  Optional photo
                  <input
                    className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-teal-800"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => setPhotoByItem((current) => ({ ...current, [item.id]: event.target.files?.[0] }))}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function AvailabilityPage({ session }: { session: UserSession }) {
  const [rows, setRows] = useState(() =>
    DAYS.map((day, index) => ({ day, day_of_week: index, enabled: index > 0 && index < 6, start_time: '08:00', end_time: '16:00' }))
  );
  const [timeOff, setTimeOff] = useState({ start_at: '', end_at: '', reason: '' });
  const [message, setMessage] = useState<string | null>(null);

  const updateRow = (index: number, patch: Partial<(typeof rows)[number]>) => {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const saveAvailability = async () => {
    setMessage('Saving availability...');
    try {
      await submitAvailability(
        session.token,
        rows.filter((row) => row.enabled).map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }))
      );
      setMessage('Weekly availability submitted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Availability failed.');
    }
  };

  const saveTimeOff = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('Submitting time off...');
    try {
      await submitTimeOff(session.token, {
        start_at: new Date(timeOff.start_at).toISOString(),
        end_at: new Date(timeOff.end_at).toISOString(),
        reason: timeOff.reason || undefined
      });
      setMessage('Time-off request submitted.');
      setTimeOff({ start_at: '', end_at: '', reason: '' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Time-off request failed.');
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-bold text-teal-700">Planning</p>
        <h2 className="text-3xl font-black tracking-tight text-slate-950">Availability</h2>
      </div>
      {message ? <p className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-teal-900">{message}</p> : null}
      <section className="glass-card rounded-[1.8rem] p-5">
        <h3 className="text-xl font-black text-slate-950">Weekly hours</h3>
        <div className="mt-4 space-y-3">
          {rows.map((row, index) => (
            <div key={row.day} className="rounded-3xl bg-white/70 p-4">
              <label className="flex items-center justify-between gap-3">
                <span className="font-extrabold text-slate-900">{row.day}</span>
                <input type="checkbox" checked={row.enabled} onChange={(event) => updateRow(index, { enabled: event.target.checked })} />
              </label>
              {row.enabled ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <input className="soft-input" type="time" value={row.start_time} onChange={(event) => updateRow(index, { start_time: event.target.value })} />
                  <input className="soft-input" type="time" value={row.end_time} onChange={(event) => updateRow(index, { end_time: event.target.value })} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <button className="teal-button mt-4 w-full" onClick={saveAvailability}>
          Submit weekly availability
        </button>
      </section>

      <form className="glass-card rounded-[1.8rem] p-5" onSubmit={saveTimeOff}>
        <h3 className="text-xl font-black text-slate-950">Time off</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-bold text-slate-700">
            Starts
            <input className="soft-input mt-2" type="datetime-local" value={timeOff.start_at} onChange={(event) => setTimeOff((current) => ({ ...current, start_at: event.target.value }))} required />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Ends
            <input className="soft-input mt-2" type="datetime-local" value={timeOff.end_at} onChange={(event) => setTimeOff((current) => ({ ...current, end_at: event.target.value }))} required />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Reason
            <textarea className="soft-input mt-2 min-h-24" value={timeOff.reason} onChange={(event) => setTimeOff((current) => ({ ...current, reason: event.target.value }))} />
          </label>
        </div>
        <button className="teal-button mt-4 w-full">Request time off</button>
      </form>
    </section>
  );
}

function defaultPayPeriod(): { start: string; end: string } {
  const start = new Date();
  const dayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 14);
  return { start: localDateKey(start), end: localDateKey(end) };
}

function EarningsPage({ session }: { session: UserSession }) {
  const [period, setPeriod] = useState(defaultPayPeriod);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setMessage('Loading earnings...');
    try {
      const start = new Date(`${period.start}T00:00:00`).toISOString();
      const end = new Date(`${period.end}T00:00:00`).toISOString();
      const next = await fetchEarnings(session.token, start, end);
      setSummary(next);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load earnings.');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hours = Number(summary?.hours ?? 0);

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-bold text-teal-700">Pay period</p>
        <h2 className="text-3xl font-black tracking-tight text-slate-950">Earnings</h2>
      </div>
      <section className="glass-card rounded-[1.8rem] p-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-bold text-slate-700">
            Start
            <input className="soft-input mt-2" type="date" value={period.start} onChange={(event) => setPeriod((current) => ({ ...current, start: event.target.value }))} />
          </label>
          <label className="text-sm font-bold text-slate-700">
            End
            <input className="soft-input mt-2" type="date" value={period.end} onChange={(event) => setPeriod((current) => ({ ...current, end: event.target.value }))} />
          </label>
        </div>
        <button className="teal-button mt-4 w-full" onClick={load}>
          Refresh summary
        </button>
      </section>
      {message ? <p className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-teal-900">{message}</p> : null}
      <section className="glass-card rounded-[1.8rem] p-5">
        <p className="text-sm font-bold text-slate-500">Estimated total</p>
        <p className="mt-2 text-4xl font-black text-slate-950">{formatMoney(summary?.total_earnings_cents ?? 0)}</p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Metric label="Hours" value={hours.toFixed(1)} />
          <Metric label="Hourly" value={formatMoney(summary?.hourly_earnings_cents ?? 0)} />
          <Metric label="Per job" value={formatMoney(summary?.per_job_earnings_cents ?? 0)} />
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/70 p-3">
      <p className="text-[11px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function SosButton({ session, jobId, onSynced }: { session: UserSession; jobId?: string; onSynced: () => void }) {
  const [status, setStatus] = useState<string | null>(null);

  const smsFallback = (coords: GeolocationCoordinates | null) => {
    const officeNumber = import.meta.env.VITE_OFFICE_SMS || localStorage.getItem('cleanops_office_sms');
    if (!officeNumber) return false;
    const location = coords ? `lat ${coords.latitude.toFixed(6)}, lng ${coords.longitude.toFixed(6)}` : 'location unavailable';
    const body = encodeURIComponent(`CleanOps SOS from ${session.user.name ?? session.user.email}. ${location}${jobId ? `, job ${jobId}` : ''}.`);
    window.location.href = `sms:${encodeURIComponent(officeNumber)}?&body=${body}`;
    return true;
  };

  const send = async () => {
    setStatus('Sending SOS...');
    const offlineAtTap = !navigator.onLine;
    const coords = await getCoordinates();
    const result = await triggerSos(session.token, {
      job_id: jobId,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      message: 'Cleaner SOS from mobile PWA'
    });
    const queued = isQueued(result);
    if (offlineAtTap || queued) {
      const openedSms = smsFallback(coords);
      setStatus(openedSms ? 'SOS queued; SMS opened.' : 'SOS queued; no office SMS number configured.');
    } else {
      setStatus('SOS sent to office.');
    }
    onSynced();
    window.setTimeout(() => setStatus(null), 5000);
  };

  return (
    <>
      <button
        className="fixed bottom-28 right-4 z-40 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-[11px] font-black text-slate-500 shadow-lg shadow-teal-900/10 backdrop-blur"
        onClick={() => void send()}
      >
        SOS
      </button>
      {status ? <p className="fixed bottom-44 right-4 z-40 max-w-56 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-teal-900 shadow-lg">{status}</p> : null}
    </>
  );
}

export default function App() {
  const [path, navigate] = useRoute();
  const online = useOnlineStatus();
  const [session, setSession] = useState<UserSession | null>(() => loadSession());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!session && path !== '/login') navigate('/login');
    if (session && path === '/login') navigate('/');
  }, [navigate, path, session]);

  useEffect(() => {
    if (!session) return undefined;
    const cleanup = installQueueSync(() => loadSession()?.token ?? null, setPendingCount);
    void getQueueCount().then(setPendingCount);
    return cleanup;
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void registerPushToken((pushToken) => registerDevicePushToken(session.token, pushToken, 'web')).catch(() => undefined);
  }, [session]);

  const refreshPendingCount = () => {
    void getQueueCount().then(setPendingCount);
  };

  if (!session || path === '/login') {
    return <LoginPage onLogin={setSession} />;
  }

  const logout = () => {
    clearSession();
    setSession(null);
    navigate('/login');
  };

  const jobMatch = path.match(/^\/jobs\/(.+)$/);
  let page = <JobsPage session={session} navigate={navigate} />;
  if (jobMatch?.[1]) page = <JobDetailPage session={session} jobId={jobMatch[1]} onPendingChange={refreshPendingCount} />;
  if (path === '/availability') page = <AvailabilityPage session={session} />;
  if (path === '/earnings') page = <EarningsPage session={session} />;

  return (
    <AppShell
      session={session}
      path={path}
      navigate={navigate}
      pendingCount={pendingCount}
      online={online}
      onLogout={logout}
      onPendingChange={refreshPendingCount}
    >
      {page}
    </AppShell>
  );
}
