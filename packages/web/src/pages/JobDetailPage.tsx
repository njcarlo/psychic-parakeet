import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { Alert, Button, Field, Input, Panel, Select } from '../components/Ui';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { currency, dateTime, propertyName, shortId } from '../lib/format';
import { useAsyncData } from '../lib/hooks';
import type { ApiItem, ApiList, ChecklistTemplate, Client, Job, JobStatus, Property } from '../lib/types';

const statuses: JobStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled', 'skipped'];

async function loadJobDetail(id: string) {
  const [job, clients, properties, templates] = await Promise.all([
    api.get<ApiItem<Job>>(`/jobs/${id}`),
    api.get<ApiList<Client>>('/clients?limit=100'),
    api.get<ApiList<Property>>('/properties?limit=100'),
    api.get<ApiList<ChecklistTemplate>>('/checklists/templates?limit=100')
  ]);
  return {
    job: job.data,
    client: clients.data.find((client) => client.id === job.data.client_id),
    property: properties.data.find((property) => property.id === job.data.property_id),
    templates: templates.data
  };
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useAsyncData(() => loadJobDetail(id!), [id]);
  const [status, setStatus] = useState<JobStatus>('scheduled');
  const [cleanerIds, setCleanerIds] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.job) {
      setStatus(data.job.status);
      setCleanerIds((data.job.user_ids ?? data.job.cleaner_ids ?? []).join(', '));
    }
  }, [data]);

  async function saveStatus() {
    if (!data) return;
    setMessage(null);
    setActionError(null);
    try {
      await api.patch<ApiItem<Job>>(`/jobs/${data.job.id}`, { status });
      setMessage('Job status saved.');
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save status');
    }
  }

  async function saveAssignments() {
    if (!data) return;
    const ids = cleanerIds
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      setActionError('Enter at least one cleaner UUID to assign.');
      return;
    }
    setMessage(null);
    setActionError(null);
    try {
      await api.post(`/jobs/${data.job.id}/assignments`, { user_ids: ids });
      setMessage('Assignments saved.');
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save assignments');
    }
  }

  return (
    <>
      <PageHeader
        title={data?.client ? `${data.client.name} job` : 'Job detail'}
        description="Review schedule, assignment IDs, pricing, property notes, and checklist setup for this visit."
        actions={
          <Link className="rounded-full border border-coastal-200 bg-white/75 px-4 py-2 text-sm font-bold text-coastal-700" to="/schedule">
            Back to schedule
          </Link>
        }
      />
      <div className="mb-4 space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {actionError ? <Alert tone="error">{actionError}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
      </div>
      {loading ? <Panel>Loading job...</Panel> : null}

      {data ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
          <div className="space-y-6">
            <Panel>
              <div className="grid gap-4 md:grid-cols-3">
                <Info label="Starts" value={dateTime(data.job.scheduled_start)} />
                <Info label="Ends" value={dateTime(data.job.scheduled_end)} />
                <Info label="Price" value={currency(data.job.price_cents, data.job.currency)} />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <StatusBadge status={data.job.status} />
                <span className="text-sm text-slate-600">Job ID {shortId(data.job.id)}</span>
              </div>
              {data.job.notes ? <p className="mt-5 rounded-2xl bg-sky-50 p-4 text-sm text-slate-700">{data.job.notes}</p> : null}
            </Panel>

            <Panel>
              <h2 className="font-display text-2xl font-bold text-coastal-900">Property</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Info label="Client" value={data.client?.name ?? 'Unknown client'} />
                <Info label="Property" value={propertyName(data.property)} />
                <Info label="Address" value={data.property?.address_line1 ?? 'Not set'} />
                <Info label="Access notes" value={data.property?.access_notes ?? 'None'} />
              </div>
            </Panel>

            <Panel>
              <h2 className="mb-4 font-display text-2xl font-bold text-coastal-900">Checklist templates</h2>
              <DataTable
                items={data.templates}
                getKey={(template) => template.id}
                empty="No checklist templates configured yet. Result retrieval is not exposed by the API."
                columns={[
                  { header: 'Template', render: (template) => <span className="font-bold text-coastal-900">{template.name}</span> },
                  { header: 'Description', render: (template) => template.description ?? template.job_type ?? 'General clean' }
                ]}
              />
              <p className="mt-4 text-sm text-slate-600">
                Checklist submissions can be posted to the API, but this backend does not yet expose a job results list endpoint.
              </p>
            </Panel>
          </div>

          <Panel className="h-fit">
            <h2 className="font-display text-2xl font-bold text-coastal-900">Office actions</h2>
            <div className="mt-5 space-y-4">
              <Field label="Status">
                <Select value={status} onChange={(event) => setStatus(event.target.value as JobStatus)}>
                  {statuses.map((item) => (
                    <option key={item} value={item}>
                      {item.replaceAll('_', ' ')}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="button" onClick={() => void saveStatus()}>
                Save status
              </Button>
              <Field label="Cleaner IDs">
                <Input value={cleanerIds} onChange={(event) => setCleanerIds(event.target.value)} placeholder="comma-separated UUIDs" />
              </Field>
              <Button type="button" onClick={() => void saveAssignments()}>
                Save assignments
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coastal-600">{label}</p>
      <p className="mt-1 font-bold text-coastal-900">{value}</p>
    </div>
  );
}
