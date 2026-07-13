import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { Alert, Button, Panel, SecondaryButton } from '../components/Ui';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { currency, dateTime } from '../lib/format';
import { useAsyncData } from '../lib/hooks';
import type { ApiItem, Invoice, InvoiceLine } from '../lib/types';

async function loadInvoice(id: string) {
  return api.get<ApiItem<Invoice>>(`/invoices/${id}`);
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useAsyncData(() => loadInvoice(id!), [id]);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function markSent() {
    if (!id) return;
    setMessage(null);
    setActionError(null);
    try {
      await api.patch<ApiItem<Invoice>>(`/invoices/${id}/sent`);
      setMessage('Invoice marked sent.');
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to mark sent');
    }
  }

  function markPaidStub() {
    setActionError(null);
    setMessage('Paid marking is ready for the UI; the API does not expose a direct mark-paid invoice endpoint yet.');
  }

  const invoice = data?.data;
  const lines: InvoiceLine[] = invoice?.lines ?? [];

  return (
    <>
      <PageHeader
        title={invoice?.invoice_number_display ?? 'Invoice detail'}
        description="Review totals, line items, dates, and office invoice status actions."
        actions={
          <Link className="rounded-full border border-coastal-200 bg-white/75 px-4 py-2 text-sm font-bold text-coastal-700" to="/invoices">
            Back to invoices
          </Link>
        }
      />
      <div className="mb-4 space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {actionError ? <Alert tone="error">{actionError}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
      </div>
      {loading ? <Panel>Loading invoice...</Panel> : null}

      {invoice ? (
        <div className="space-y-6">
          <Panel>
            <div className="grid gap-4 md:grid-cols-5">
              <Info label="Status" value={<StatusBadge status={invoice.status} />} />
              <Info label="Issued" value={dateTime(invoice.issued_at)} />
              <Info label="Due" value={dateTime(invoice.due_at ?? invoice.due_date)} />
              <Info label="Subtotal" value={currency(invoice.subtotal_cents, invoice.currency)} />
              <Info label="Total" value={currency(invoice.total_cents, invoice.currency)} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={() => void markSent()} disabled={invoice.status === 'sent' || invoice.status === 'paid'}>
                Mark sent
              </Button>
              <SecondaryButton type="button" onClick={markPaidStub} disabled={invoice.status === 'paid'}>
                Mark paid
              </SecondaryButton>
            </div>
          </Panel>

          <DataTable
            items={lines}
            getKey={(line) => line.id}
            empty="No line items returned for this invoice."
            columns={[
              { header: 'Description', render: (line) => <span className="font-bold text-coastal-900">{line.description}</span> },
              { header: 'Qty', render: (line) => line.quantity },
              { header: 'Unit', render: (line) => currency(line.unit_price_cents, invoice.currency) },
              { header: 'Tax', render: (line) => currency(line.tax_cents, invoice.currency) },
              { header: 'Line total', render: (line) => currency(line.line_total_cents, invoice.currency) }
            ]}
          />
        </div>
      ) : null}
    </>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coastal-600">{label}</p>
      <div className="mt-1 font-bold text-coastal-900">{value}</div>
    </div>
  );
}
