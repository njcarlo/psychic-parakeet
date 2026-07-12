import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Ui';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { currency, dateOnly, endOfTodayIso, startOfTodayIso, timeOnly } from '../lib/format';
import { useAsyncData } from '../lib/hooks';
import type { ApiList, DashboardStats, Invoice, Job, SosAlert } from '../lib/types';

type DashboardData = {
  stats: DashboardStats;
  upcoming: Job[];
  sos: SosAlert[];
  invoices: Invoice[];
};

async function loadDashboard(): Promise<DashboardData> {
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  const [todaysJobs, upcomingJobs, sos, invoices] = await Promise.all([
    api.get<ApiList<Job>>(`/jobs?start=${encodeURIComponent(startOfTodayIso())}&end=${encodeURIComponent(endOfTodayIso())}&limit=100`),
    api.get<ApiList<Job>>(`/jobs?start=${encodeURIComponent(now.toISOString())}&end=${encodeURIComponent(nextWeek.toISOString())}&limit=8`),
    api.get<ApiList<SosAlert>>('/sos?limit=20'),
    api.get<ApiList<Invoice>>('/invoices?limit=100')
  ]);

  const overdue = invoices.data.filter((invoice) => {
    const due = invoice.due_at ?? invoice.due_date;
    return due && new Date(due) < now && !['paid', 'void'].includes(invoice.status);
  });

  return {
    stats: {
      todaysJobs: todaysJobs.data.length,
      openSos: sos.data.length,
      overdueInvoices: overdue.length,
      overdueAmountCents: overdue.reduce((sum, invoice) => sum + (invoice.total_cents ?? 0), 0)
    },
    upcoming: upcomingJobs.data,
    sos: sos.data.slice(0, 4),
    invoices: overdue.slice(0, 4)
  };
}

export function DashboardPage() {
  const { data, loading, error } = useAsyncData(loadDashboard, []);

  return (
    <>
      <PageHeader
        title="Today in the office"
        description="A calm operational snapshot for dispatch, billing, alerts, and the next cleaning runs."
      />

      {error ? <Panel className="mb-6 text-sm text-red-700">{error}</Panel> : null}
      {loading ? <Panel>Loading dashboard...</Panel> : null}

      {data ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <Metric label="Today's jobs" value={data.stats.todaysJobs} to="/schedule" />
            <Metric label="Open SOS" value={data.stats.openSos} to="/sos" urgent={data.stats.openSos > 0} />
            <Metric label="Overdue invoices" value={data.stats.overdueInvoices} to="/invoices" />
            <Metric label="Overdue amount" value={currency(data.stats.overdueAmountCents)} to="/invoices" />
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
                        <p className="font-bold text-coastal-900">{dateOnly(job.scheduled_start)}</p>
                        <p className="text-sm text-slate-600">
                          {timeOnly(job.scheduled_start)} - {timeOnly(job.scheduled_end)}
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
                <h2 className="font-display text-2xl font-bold text-coastal-900">SOS alerts</h2>
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
                <h2 className="font-display text-2xl font-bold text-coastal-900">Overdue invoices</h2>
                <div className="mt-4 space-y-3">
                  {data.invoices.length === 0 ? (
                    <p className="text-sm text-slate-600">No overdue invoices.</p>
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
