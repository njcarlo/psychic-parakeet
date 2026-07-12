import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Alert, Button, Field, Input, SecondaryButton, Select, Textarea } from '../components/Ui';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/hooks';
import type { ApiItem, ApiList, Client } from '../lib/types';

type ClientForm = {
  name: string;
  email: string;
  phone: string;
  comm_preference: 'sms' | 'email' | 'phone' | 'none';
  billing_address: string;
  notes: string;
};

const emptyForm: ClientForm = {
  name: '',
  email: '',
  phone: '',
  comm_preference: 'email',
  billing_address: '',
  notes: ''
};

async function loadClients() {
  return api.get<ApiList<Client>>('/clients?limit=100');
}

export function ClientsPage() {
  const { data, loading, error, reload } = useAsyncData(loadClients, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      comm_preference: ['sms', 'email', 'phone', 'none'].includes(client.comm_preference)
        ? (client.comm_preference as ClientForm['comm_preference'])
        : 'email',
      billing_address: client.billing_address ?? '',
      notes: client.notes ?? ''
    });
    setFormError(null);
    setModalOpen(true);
  }

  function update(field: keyof ClientForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const payload = {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      comm_preference: form.comm_preference,
      billing_address: form.billing_address || undefined,
      notes: form.notes || undefined
    };

    try {
      if (editing) {
        await api.patch<ApiItem<Client>>(`/clients/${editing.id}`, payload);
      } else {
        await api.post<ApiItem<Client>>('/clients', payload);
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save client');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description="Manage cleaning clients and the communication preference used by office workflows."
        actions={<Button onClick={openCreate}>Add client</Button>}
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <p className="text-sm text-slate-600">Loading clients...</p> : null}
      {data ? (
        <DataTable
          items={data.data}
          getKey={(client) => client.id}
          empty="No clients yet. Add your first commercial or residential customer."
          columns={[
            {
              header: 'Client',
              render: (client) => (
                <div>
                  <Link to={`/clients/${client.id}`} className="font-bold text-coastal-900 hover:text-coastal-600">
                    {client.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">{client.billing_address ?? 'No billing address'}</p>
                </div>
              )
            },
            { header: 'Email', render: (client) => client.email ?? 'Not set' },
            { header: 'Phone', render: (client) => client.phone ?? 'Not set' },
            { header: 'Comms', render: (client) => <StatusBadge status={client.comm_preference} /> },
            {
              header: 'Actions',
              render: (client) => <SecondaryButton onClick={() => openEdit(client)}>Edit</SecondaryButton>
            }
          ]}
        />
      ) : null}

      <Modal title={editing ? 'Edit client' : 'Add client'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          {formError ? (
            <div className="sm:col-span-2">
              <Alert tone="error">{formError}</Alert>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Field label="Client name">
              <Input value={form.name} onChange={(event) => update('name', event.target.value)} required />
            </Field>
          </div>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(event) => update('phone', event.target.value)} />
          </Field>
          <Field label="Communication preference">
            <Select
              value={form.comm_preference}
              onChange={(event) => update('comm_preference', event.target.value)}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="phone">Phone</option>
              <option value="none">None</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Billing address">
              <Textarea value={form.billing_address} onChange={(event) => update('billing_address', event.target.value)} rows={2} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} rows={3} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save client'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
