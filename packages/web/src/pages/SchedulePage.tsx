import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Alert, Button, Field, Input, Panel, SecondaryButton, Select } from '../components/Ui';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { dateOnly, isoFromLocalInput, propertyName, shortId, timeOnly, toDateTimeLocal } from '../lib/format';
import { useAsyncData } from '../lib/hooks';
import type { ApiItem, ApiList, Availability, Client, Job, JobStatus, Property } from '../lib/types';

const statuses: JobStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled', 'skipped'];

type CreateJobForm = {
  client_id: string;
  property_id: string;
  scheduled_start: string;
  scheduled_end: string;
  price: string;
  cleaner_id: string;
};

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
  const [jobs, clients, properties, availability] = await Promise.all([
    api.get<ApiList<Job>>(`/jobs/calendar?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`),
    api.get<ApiList<Client>>('/clients?limit=100'),
    api.get<ApiList<Property>>('/properties?limit=100'),
    api.get<ApiList<Availability>>('/availability?limit=100')
  ]);
  return {
    jobs: jobs.data,
    clients: clients.data,
    properties: properties.data,
    availability: availability.data
  };
}

function defaultCreateJobForm(): CreateJobForm {
  const start = new Date();
  start.setMinutes(start.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (start <= new Date()) start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(start.getHours() + 2);
  return {
    client_id: '',
    property_id: '',
    scheduled_start: toDateTimeLocal(start),
    scheduled_end: toDateTimeLocal(end),
    price: '120.00',
    cleaner_id: ''
  };
}

export function SchedulePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [createOpen, setCreateOpen] = useState(() => window.location.hash === '#create-job');
  const [form, setForm] = useState<CreateJobForm>(() => defaultCreateJobForm());
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const weekStartIso = weekStart.toISOString();
  const { data, loading, error, reload } = useAsyncData(() => loadSchedule(weekStartIso), [weekStartIso]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const jobs = data?.jobs.filter((job) => new Date(job.scheduled_start).toDateString() === date.toDateString()) ?? [];
        return { date, jobs };
      }),
    [data, weekStart]
  );

  const propertiesForClient = useMemo(
    () => data?.properties.filter((property) => property.client_id === form.client_id) ?? [],
    [data, form.client_id]
  );

  const cleanerOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const slot of data?.availability ?? []) {
      const id = slot.cleaner_id ?? slot.user_id;
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }, [data]);

  function updateForm(field: keyof CreateJobForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'client_id' ? { property_id: '' } : {})
    }));
  }

  function openCreate() {
    setErrorMessage(null);
    setMessage(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    if (window.location.hash === '#create-job') {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    setErrorMessage(null);

    const priceCents = Math.round(Number(form.price) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setErrorMessage('Enter a valid job price.');
      setCreating(false);
      return;
    }

    try {
      const created = await api.post<ApiItem<Job>>('/jobs', {
        client_id: form.client_id,
        property_id: form.property_id,
        scheduled_start: isoFromLocalInput(form.scheduled_start),
        scheduled_end: isoFromLocalInput(form.scheduled_end),
        price_cents: priceCents
      });
      if (form.cleaner_id) {
        await api.post(`/jobs/${created.data.id}/assignments`, { user_ids: [form.cleaner_id] });
      }
      setMessage(form.cleaner_id ? 'Job created and cleaner assigned.' : 'Job created.');
      setForm(defaultCreateJobForm());
      closeCreate();
      await reload();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to create job');
    } finally {
      setCreating(false);
    }
  }

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
      await api.post(`/jobs/${job.id}/assignments`, { user_ids: cleanerIds });
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
            <Button onClick={openCreate}>Create job</Button>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
        {days.map(({ date, jobs }) => (
          <section
            key={date.toISOString()}
            className="flex min-h-32 flex-col rounded-3xl border border-white/70 bg-white/72 p-3 shadow-sm sm:p-4"
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <p className="font-display text-base font-bold leading-tight text-coastal-900">{dateOnly(date.toISOString())}</p>
              <p className="shrink-0 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-coastal-600">{jobs.length} jobs</p>
            </div>
            <div className="space-y-2">
              {jobs.length === 0 ? (
                <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-slate-500">Open</p>
              ) : null}
              {jobs.map((job) => (
                <ScheduleJob
                  key={job.id}
                  job={job}
                  clients={data?.clients ?? []}
                  properties={data?.properties ?? []}
                  onStatus={changeStatus}
                  onAssign={assign}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <Modal title="Create ad-hoc job" open={createOpen} onClose={closeCreate}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={createJob}>
          <div className="sm:col-span-2">
            <Alert>Schedule a one-off clean, price it, then optionally assign a cleaner for the MVP demo.</Alert>
          </div>
          {errorMessage ? (
            <div className="sm:col-span-2">
              <Alert tone="error">{errorMessage}</Alert>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Field label="Client">
              <Select value={form.client_id} onChange={(event) => updateForm('client_id', event.target.value)} required>
                <option value="">Choose client</option>
                {data?.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Property">
              <Select
                value={form.property_id}
                onChange={(event) => updateForm('property_id', event.target.value)}
                required
                disabled={!form.client_id}
              >
                <option value="">{form.client_id ? 'Choose property' : 'Choose a client first'}</option>
                {propertiesForClient.map((property) => (
                  <option key={property.id} value={property.id}>
                    {propertyName(property)} - {property.address_line1}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Start">
            <Input
              type="datetime-local"
              value={form.scheduled_start}
              onChange={(event) => updateForm('scheduled_start', event.target.value)}
              required
            />
          </Field>
          <Field label="End">
            <Input
              type="datetime-local"
              value={form.scheduled_end}
              onChange={(event) => updateForm('scheduled_end', event.target.value)}
              required
            />
          </Field>
          <Field label="Price (NZD)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => updateForm('price', event.target.value)}
              required
            />
          </Field>
          <Field label="Cleaner">
            <Select value={form.cleaner_id} onChange={(event) => updateForm('cleaner_id', event.target.value)}>
              <option value="">Unassigned for now</option>
              {cleanerOptions.map((cleanerId) => (
                <option key={cleanerId} value={cleanerId}>
                  Cleaner {shortId(cleanerId)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating || !data}>
              {creating ? 'Creating...' : 'Create job'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function ScheduleJob({
  job,
  clients,
  properties,
  onStatus,
  onAssign
}: {
  job: Job;
  clients: Client[];
  properties: Property[];
  onStatus: (job: Job, status: JobStatus) => Promise<void>;
  onAssign: (job: Job, cleanerIdsText: string) => Promise<void>;
}) {
  const [cleanerIds, setCleanerIds] = useState((job.user_ids ?? job.cleaner_ids ?? []).join(', '));
  const [assigning, setAssigning] = useState(false);
  const client = clients.find((item) => item.id === job.client_id);
  const property = properties.find((item) => item.id === job.property_id);

  async function submitAssignment() {
    setAssigning(true);
    try {
      await onAssign(job, cleanerIds);
    } finally {
      setAssigning(false);
    }
  }

  const compactControl =
    'w-full rounded-lg border border-coastal-100 bg-white/90 px-2 py-1 text-xs text-slate-800 outline-none ring-coastal-500/20 transition focus:border-coastal-500 focus:ring-2';

  return (
    <article className="rounded-xl border border-coastal-100 bg-white/75 p-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/jobs/${job.id}`} className="block truncate font-bold text-coastal-900 hover:text-coastal-600">
            {client?.name ?? `Job ${shortId(job.id)}`}
          </Link>
          <p className="truncate text-xs text-slate-500">
            {property ? `${propertyName(property)} - ` : ''}
            {timeOnly(job.scheduled_start)}-{timeOnly(job.scheduled_end)}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="mt-2 space-y-1.5">
        <select
          aria-label="Job status"
          value={job.status}
          onChange={(event) => void onStatus(job, event.target.value as JobStatus)}
          className={compactControl}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <input
            aria-label="Cleaner IDs"
            value={cleanerIds}
            onChange={(event) => setCleanerIds(event.target.value)}
            placeholder="Cleaner IDs"
            className={`${compactControl} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => void submitAssignment()}
            disabled={assigning}
            className="shrink-0 rounded-lg bg-coastal-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-coastal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {assigning ? '...' : 'Assign'}
          </button>
        </div>
      </div>
    </article>
  );
}
