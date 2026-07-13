import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Alert, Button, Field, Input, Panel, Select } from '../components/Ui';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { currency, dateOnly } from '../lib/format';
import { useAsyncData } from '../lib/hooks';
import type { ApiItem, ApiList, Client, Invoice, Job } from '../lib/types';

async function loadInvoicesPage() {
  const [invoices, clients, jobs] = await Promise.all([
    api.get<ApiList<Invoice>>('/invoices?limit=100'),
    api.get<ApiList<Client>>('/clients?limit=100'),
    api.get<ApiList<Job>>('/jobs?limit=100')
  ]);
  return { invoices: invoices.data, clients: clients.data, jobs: jobs.data };
}

export function InvoicesPage() {
  const { data, loading, error, reload } = useAsyncData(loadInvoicesPage, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const jobsForClient = useMemo(
    () => data?.jobs.filter((job) => job.status === 'completed' && (!clientId || job.client_id === clientId)) ?? [],
    [clientId, data]
  );

  function toggleJob(id: string) {
    setSelectedJobs((current) => (current.includes(id) ? current.filter((jobId) => jobId !== id) : [...current, id]));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    if (!clientId || selectedJobs.length === 0) {
      setFormError('Choose a client and at least one job.');
      setSubmitting(false);
      return;
    }

    try {
      await api.post<ApiItem<Invoice>>('/invoices', {
        client_id: clientId,
        job_ids: selectedJobs,
        due_at: dueDate || undefined,
        currency: 'NZD'
      });
      setModalOpen(false);
      setClientId('');
      setSelectedJobs([]);
      setDueDate('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create invoice');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Bill completed cleans"
        description="Select a client, choose completed jobs, and create a simple invoice for the MVP demo."
        actions={<Button onClick={() => setModalOpen(true)}>Bill completed cleans</Button>}
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <Panel>Loading invoices...</Panel> : null}
      {data ? (
        <DataTable
          items={data.invoices}
          getKey={(invoice) => invoice.id}
          empty="No invoices yet. Complete a job, then bill the clean from here."
          columns={[
            {
              header: 'Invoice',
              render: (invoice) => (
                <Link to={`/invoices/${invoice.id}`} className="font-bold text-coastal-900 hover:text-coastal-600">
                  {invoice.invoice_number_display ?? `#${invoice.invoice_number}`}
                </Link>
              )
            },
            {
              header: 'Client',
              render: (invoice) => data.clients.find((client) => client.id === invoice.client_id)?.name ?? 'Unknown'
            },
            { header: 'Status', render: (invoice) => <StatusBadge status={invoice.status} /> },
            { header: 'Due', render: (invoice) => dateOnly(invoice.due_at ?? invoice.due_date) },
            { header: 'Total', render: (invoice) => currency(invoice.total_cents, invoice.currency) }
          ]}
        />
      ) : null}

      <Modal title="Bill completed cleans" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field label="Client">
            <Select
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setSelectedJobs([]);
              }}
              required
            >
              <option value="">Choose client</option>
              {data?.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-bold text-coastal-900">Jobs</p>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-3xl border border-coastal-100 bg-white/60 p-3">
              {jobsForClient.length === 0 ? <p className="text-sm text-slate-600">No completed jobs for this client yet.</p> : null}
              {jobsForClient.map((job) => (
                <label key={job.id} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white/70 p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedJobs.includes(job.id)}
                    onChange={() => toggleJob(job.id)}
                  />
                  <span>
                    <span className="block font-bold text-coastal-900">{dateOnly(job.scheduled_start)}</span>
                    <span className="text-slate-600">{currency(job.price_cents, job.currency)}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create invoice'}
          </Button>
        </form>
      </Modal>
    </>
  );
}
