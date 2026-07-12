import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Alert, Button, Field, Input, Panel, SecondaryButton, Select } from '../components/Ui';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { dateOnly, dateTime, timeOnly } from '../lib/format';
import { useAsyncData } from '../lib/hooks';
import type { ApiItem, ApiList, Job, JobStatus } from '../lib/types';

const statuses: JobStatus[] = ['scheduled', 'assigned', 'in_progress', 'completed', 'cancelled', 'no_show'];

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function loadSchedule(weekStartIso: string) {
  const start = new Date(weekStartIso);
  const end = addDays(start, 7);
  return api.get<ApiList<Job>>(`/jobs/calendar?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
}

export function SchedulePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const weekStartIso = weekStart.toISOString();
  const { data, loading, error, reload } = useAsyncData(() => loadSchedule(weekStartIso), [weekStartIso]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const jobs = data?.data.filter((job) => new Date(job.scheduled_start).toDateString() === date.toDateString()) ?? [];
        return { date, jobs };
      }),
    [data, weekStart]
  );

  async function changeStatus(job: Job, status: JobStatus) {
    setMessage(null);
    setErrorMessage(null);
    try {
      await api.patch<ApiItem<Job>>(`/jobs/${job.id}`, { status });
      setMessage('Job status updated.');
      await reload();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to update job');
    }
  }

  async function assign(job: Job, cleanerIdsText: string) {
    const cleanerIds = cleanerIdsText
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (cleanerIds.length === 0) return;

    setMessage(null);
    setErrorMessage(null);
    try {
      await api.post(`/jobs/${job.id}/assignments`, { cleanerIds });
      setMessage('Assignments updated.');
      await reload();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to update assignments');
    }
  }

  return (
    <>
      <PageHeader
        title="Weekly schedule"
        description="Dispatch-ready calendar view with status changes and simple reassignment controls."
        actions={
          <>
            <SecondaryButton onClick={() => setWeekStart(addDays(weekStart, -7))}>Previous week</SecondaryButton>
            <SecondaryButton onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</SecondaryButton>
            <SecondaryButton onClick={() => setWeekStart(addDays(weekStart, 7))}>Next week</SecondaryButton>
          </>
        }
      />
      <div className="mb-4 space-y-3">
        {message ? <Alert tone="success">{message}</Alert> : null}
        {error || errorMessage ? <Alert tone="error">{error ?? errorMessage}</Alert> : null}
      </div>
      {loading ? <Panel>Loading schedule...</Panel> : null}

      <div className="grid gap-4 xl:grid-cols-7">
        {days.map(({ date, jobs }) => (
          <Panel key={date.toISOString()} className="min-h-64">
            <div className="mb-4">
              <p className="font-display text-xl font-bold text-coastal-900">{dateOnly(date.toISOString())}</p>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-coastal-600">{jobs.length} jobs</p>
            </div>
            <div className="space-y-3">
              {jobs.length === 0 ? <p className="rounded-2xl bg-sky-50 p-3 text-sm text-slate-500">Open</p> : null}
              {jobs.map((job) => (
                <ScheduleJob key={job.id} job={job} onStatus={changeStatus} onAssign={assign} />
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

function ScheduleJob({
  job,
  onStatus,
  onAssign
}: {
  job: Job;
  onStatus: (job: Job, status: JobStatus) => Promise<void>;
  onAssign: (job: Job, cleanerIdsText: string) => Promise<void>;
}) {
  const [cleanerIds, setCleanerIds] = useState((job.cleaner_ids ?? []).join(', '));
  const [assigning, setAssigning] = useState(false);

  async function submitAssignment() {
    setAssigning(true);
    try {
      await onAssign(job, cleanerIds);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <article className="rounded-2xl border border-coastal-100 bg-white/75 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link to={`/jobs/${job.id}`} className="font-bold text-coastal-900 hover:text-coastal-600">
            {timeOnly(job.scheduled_start)}
          </Link>
          <p className="text-xs text-slate-500">{dateTime(job.scheduled_end)}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="mt-3 space-y-2">
        <Field label="Status">
          <Select value={job.status} onChange={(event) => void onStatus(job, event.target.value as JobStatus)}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cleaner IDs">
          <Input value={cleanerIds} onChange={(event) => setCleanerIds(event.target.value)} placeholder="comma-separated UUIDs" />
        </Field>
        <Button type="button" onClick={() => void submitAssignment()} disabled={assigning} className="w-full">
          {assigning ? 'Assigning...' : 'Save assignment'}
        </Button>
      </div>
    </article>
  );
}
