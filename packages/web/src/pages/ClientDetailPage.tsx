import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Alert, Button, Field, Input, Panel, Textarea } from '../components/Ui';
import { api } from '../lib/api';
import { propertyName } from '../lib/format';
import { useAsyncData } from '../lib/hooks';
import type { ApiItem, ApiList, Client, Property } from '../lib/types';

type PropertyForm = {
  name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  access_notes: string;
  service_notes: string;
};

const emptyProperty: PropertyForm = {
  name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  region: '',
  postal_code: '',
  access_notes: '',
  service_notes: ''
};

async function loadClientDetail(id: string) {
  const [client, properties] = await Promise.all([
    api.get<ApiItem<Client>>(`/clients/${id}`),
    api.get<ApiList<Property>>('/properties?limit=100')
  ]);
  return { client: client.data, properties: properties.data.filter((property) => property.client_id === id) };
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useAsyncData(() => loadClientDetail(id!), [id]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PropertyForm>(emptyProperty);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => data?.client.name ?? 'Client detail', [data]);

  function update(field: keyof PropertyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post<ApiItem<Property>>('/properties', {
        client_id: id,
        name: form.name,
        address_line1: form.address_line1,
        address_line2: form.address_line2 || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        postal_code: form.postal_code || undefined,
        country: 'NZ',
        access_notes: form.access_notes || undefined,
        service_notes: form.service_notes || undefined
      });
      setForm(emptyProperty);
      setModalOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save property');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        description="Client profile with contact details and the properties your cleaning teams visit."
        actions={
          <>
            <Link className="rounded-full border border-coastal-200 bg-white/75 px-4 py-2 text-sm font-bold text-coastal-700" to="/clients">
              Back to clients
            </Link>
            <Button onClick={() => setModalOpen(true)}>Add property</Button>
          </>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <Panel>Loading client...</Panel> : null}

      {data ? (
        <div className="space-y-6">
          <Panel>
            <div className="grid gap-4 md:grid-cols-4">
              <Info label="Email" value={data.client.email ?? 'Not set'} />
              <Info label="Phone" value={data.client.phone ?? 'Not set'} />
              <Info label="Comms" value={data.client.comm_preference} />
              <Info label="Properties" value={data.properties.length.toString()} />
            </div>
            {data.client.notes ? <p className="mt-5 rounded-2xl bg-sky-50 p-4 text-sm text-slate-700">{data.client.notes}</p> : null}
          </Panel>

          <DataTable
            items={data.properties}
            getKey={(property) => property.id}
            empty="No properties for this client yet."
            columns={[
              { header: 'Property', render: (property) => <span className="font-bold text-coastal-900">{propertyName(property)}</span> },
              {
                header: 'Address',
                render: (property) => (
                  <span>
                    {property.address_line1}
                    {property.city ? `, ${property.city}` : ''}
                  </span>
                )
              },
              { header: 'Region', render: (property) => property.region ?? 'Not set' },
              { header: 'Access notes', render: (property) => property.access_notes ?? 'None' }
            ]}
          />
        </div>
      ) : null}

      <Modal title="Add property" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          {formError ? (
            <div className="sm:col-span-2">
              <Alert tone="error">{formError}</Alert>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Field label="Property name">
              <Input value={form.name} onChange={(event) => update('name', event.target.value)} required />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address line 1">
              <Input value={form.address_line1} onChange={(event) => update('address_line1', event.target.value)} required />
            </Field>
          </div>
          <Field label="Address line 2">
            <Input value={form.address_line2} onChange={(event) => update('address_line2', event.target.value)} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(event) => update('city', event.target.value)} />
          </Field>
          <Field label="Region">
            <Input value={form.region} onChange={(event) => update('region', event.target.value)} />
          </Field>
          <Field label="Postal code">
            <Input value={form.postal_code} onChange={(event) => update('postal_code', event.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Access notes">
              <Textarea value={form.access_notes} onChange={(event) => update('access_notes', event.target.value)} rows={2} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Service notes">
              <Textarea value={form.service_notes} onChange={(event) => update('service_notes', event.target.value)} rows={2} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save property'}
            </Button>
          </div>
        </form>
      </Modal>
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
