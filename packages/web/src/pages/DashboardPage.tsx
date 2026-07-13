import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Ui';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { currency, dateOnly, endOfTodayIso, propertyName, shortId, startOfTodayIso, timeOnly } from '../lib/format';
import { useAsyncData } from '../lib/hooks';
import type { ApiList, Client, DashboardStats, Invoice, Job, Property, SosAlert } from '../lib/types';

type DashboardData = {
  stats: DashboardStats;
  upcoming: Job[];
  sos: SosAlert[];
  invoices: Invoice[];
  clients: Client[];
  properties: Property[];
};

async function loadDashboard(): Promise<DashboardData> {
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  const [todaysJobs, upcomingJobs, sos, invoices, clients, properties] = await Promise.all([
    api.get<ApiList<Job>>(`/jobs?start=${encodeURIComponent(startOfTodayIso())}&end=${encodeURIComponent(endOfTodayIso())}&limit=100`),
    api.get<ApiList<Job>>(`/jobs?start=${encodeURIComponent(now.toISOString())}&end=${encodeURIComponent(nextWeek.toISOString())}&limit=8`),
    api.get<ApiList<SosAlert>>('/sos?limit=20'),
    api.get<ApiList<Invoice>>('/invoices?limit=100'),
    api.get<ApiList<Client>>('/clients?limit=100'),
    api.get<ApiList<Property>>('/properties?limit=100')
  ]);

  const openInvoices = invoices.data.filter((invoice) => !['paid', 'void'].includes(invoice.status));
  const overdue = openInvoices.filter((invoice) => {
    const due = invoice.due_at ?? invoice.due_date;
    return due && new Date(due) < now;
  });

  return {
    stats: {
      todaysJobs: todaysJobs.data.length,
      completedToday: todaysJobs.data.filter((job) => job.status === 'completed').length,
      openInvoices: openInvoices.length,
      openSos: sos.data.length,
      overdueInvoices: overdue.length,
      overdueAmountCents: overdue.reduce((sum, invoice) => sum + (invoice.total_cents ?? 0), 0)
    },
    upcoming: upcomingJobs.data,
    sos: sos.data.slice(0, 4),
    invoices: overdue.slice(0, 4),
    clients: clients.data,
    properties: properties.data
  };
}

export function DashboardPage() {
  const { data, loading, error } = useAsyncData(loadDashboard, []);

  return (
    <>
      <PageHeader
        title="Today's operations"
        description="The MVP command centre for booking work, assigning cleaners, and billing completed cleans."
        actions={
          <>
            <Link className="rounded-full bg-coastal-600 px-4 py-2 text-sm font-bold text-white shadow-sm" to="/clients">
              Add client
            </Link>
            <Link className="rounded-full border border-coastal-200 bg-white/75 px-4 py-2 text-sm font-bold text-coastal-700" to="/schedule#create-job">
              Create job
            </Link>
          </>
        }
      />

      {error ? <Panel className="mb-6 text-sm text-red-700">{error}</Panel> : null}
      {loading ? <Panel>Loading dashboard...</Panel> : null}

      {data ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <Metric label="Today's jobs" value={data.stats.todaysJobs} to="/schedule" />
            <Metric label="Completed today" value={data.stats.completedToday} to="/schedule" />
            <Metric label="Open invoices" value={data.stats.openInvoices} to="/invoices" />
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <Panel>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold text-coastal-900">Upcoming schedule</h2>
                <Link to="/schedule" className="text-sm font-bold text-coastal-700">
                  View week
                </Link>
              </div>
              <div className="space-y-3">
                {data.upcoming.length === 0 ? (
                  <p className="rounded-2xl bg-sky-50 px-4 py-5 text-sm text-slate-600">No upcoming jobs in the next week.</p>
                ) : (
                  data.upcoming.map((job) => (
                    <Link
                      key={job.id}
                      to={`/jobs/${job.id}`}
                      className="flex flex-col gap-2 rounded-2xl border border-coastal-100 bg-white/70 p-4 hover:bg-white sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold text-coastal-900">{jobSummary(job, data.clients, data.properties)}</p>
                        <p className="text-sm text-slate-600">
                          {dateOnly(job.scheduled_start)} - {timeOnly(job.scheduled_start)} - {timeOnly(job.scheduled_end)}
                        </p>
                      </div>
                      <StatusBadge status={job.status} />
                    </Link>
                  ))
                )}
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-2xl font-bold text-coastal-900">SOS alerts</h2>
                  <Link to="/sos" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Later
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {data.sos.length === 0 ? (
                    <p className="text-sm text-slate-600">No open SOS alerts.</p>
                  ) : (
                    data.sos.map((alert) => (
                      <Link key={alert.id} to="/sos" className="block rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                        <span className="font-bold">Open alert</span> {alert.message ?? alert.notes ?? 'Needs office attention'}
                      </Link>
                    ))
                  )}
                </div>
              </Panel>

              <Panel>
                <h2 className="font-display text-2xl font-bold text-coastal-900">Billing follow-up</h2>
                <div className="mt-4 space-y-3">
                  {data.invoices.length === 0 ? (
                    <p className="text-sm text-slate-600">No overdue invoices. Create invoices once cleans are completed.</p>
                  ) : (
                    data.invoices.map((invoice) => (
                      <Link
                        key={invoice.id}
                        to={`/invoices/${invoice.id}`}
                        className="flex items-center justify-between rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"
                      >
                        <span className="font-bold">{invoice.invoice_number_display ?? `#${invoice.invoice_number}`}</span>
                        <span>{currency(invoice.total_cents, invoice.currency)}</span>
                      </Link>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function jobSummary(job: Job, clients: Client[], properties: Property[]): string {
  const client = clients.find((item) => item.id === job.client_id);
  const property = properties.find((item) => item.id === job.property_id);
  if (client && property) return `${client.name} - ${propertyName(property)}`;
  if (client) return client.name;
  if (property) return propertyName(property);
  return `Job ${shortId(job.id)}`;
}

function Metric({ label, value, to, urgent = false }: { label: string; value: string | number; to: string; urgent?: boolean }) {
  return (
    <Link
      to={to}
      className={`rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 ${
        urgent ? 'border-red-200 bg-red-50 text-red-900' : 'border-white/70 bg-white/72 text-coastal-900'
      }`}
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-3 font-display text-4xl font-bold">{value}</p>
    </Link>
  );
}
