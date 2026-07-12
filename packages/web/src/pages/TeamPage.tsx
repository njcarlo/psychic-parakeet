import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { Alert, Button, Field, Input, Panel, Select, Textarea } from '../components/Ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { dayNames, shortId } from '../lib/format';
import { useAsyncData } from '../lib/hooks';
import type { ApiItem, ApiList, Availability } from '../lib/types';

async function loadTeamData() {
  return api.get<ApiList<Availability>>('/availability?limit=100');
}

export function TeamPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsyncData(loadTeamData, []);
  const [requestId, setRequestId] = useState('');
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const grouped = useMemo(() => {
    const groups = new Map<string, Availability[]>();
    for (const slot of data?.data ?? []) {
      const cleanerId = slot.cleaner_id ?? slot.user_id ?? 'unknown';
      groups.set(cleanerId, [...(groups.get(cleanerId) ?? []), slot]);
    }
    return Array.from(groups.entries()).map(([cleanerId, slots]) => ({ cleanerId, slots }));
  }, [data]);

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setActionError(null);
    try {
      await api.patch<ApiItem<unknown>>(`/availability/time-off/${requestId}/${decision}`, {
        decision_notes: notes || undefined
      });
      setMessage(`Time-off request ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      setRequestId('');
      setNotes('');
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to submit decision');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Cleaner/admin overview using current availability data and office time-off decision actions."
      />
      <div className="mb-4 space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {actionError ? <Alert tone="error">{actionError}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="space-y-6">
          <Panel>
            <h2 className="font-display text-2xl font-bold text-coastal-900">Signed-in office user</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Info label="Name" value={user?.name ?? user?.full_name ?? 'Not set'} />
              <Info label="Role" value={user?.role ?? 'Unknown'} />
              <Info label="Email" value={user?.email ?? 'Unknown'} />
            </div>
            <p className="mt-4 text-sm text-slate-600">
              The API does not currently expose a full users list, so team identity rows are inferred from availability cleaner IDs.
            </p>
          </Panel>

          {loading ? <Panel>Loading availability...</Panel> : null}
          <DataTable
            items={grouped}
            getKey={(group) => group.cleanerId}
            empty="No availability has been recorded yet."
            columns={[
              {
                header: 'Cleaner/Admin',
                render: (group) => <span className="font-bold text-coastal-900">User {shortId(group.cleanerId)}</span>
              },
              {
                header: 'Availability',
                render: (group) => (
                  <div className="flex flex-wrap gap-2">
                    {group.slots.map((slot) => (
                      <span key={slot.id} className="rounded-full bg-coastal-50 px-3 py-1 text-xs font-bold text-coastal-800">
                        {dayNames[slot.day_of_week]} {slot.start_time}-{slot.end_time}
                      </span>
                    ))}
                  </div>
                )
              }
            ]}
          />
        </div>

        <Panel className="h-fit">
          <h2 className="font-display text-2xl font-bold text-coastal-900">Approve time-off</h2>
          <p className="mt-2 text-sm text-slate-600">
            Time-off create/decision endpoints exist, but there is no list endpoint yet. Paste a pending request ID to decide it.
          </p>
          <form className="mt-5 space-y-4" onSubmit={submitDecision}>
            <Field label="Request ID">
              <Input value={requestId} onChange={(event) => setRequestId(event.target.value)} required placeholder="UUID" />
            </Field>
            <Field label="Decision">
              <Select value={decision} onChange={(event) => setDecision(event.target.value as 'approve' | 'reject')}>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
              </Select>
            </Field>
            <Field label="Decision notes">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </Field>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit decision'}
            </Button>
          </form>
        </Panel>
      </div>
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
