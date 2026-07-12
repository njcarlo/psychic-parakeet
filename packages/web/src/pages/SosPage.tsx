import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Alert, Button, Field, Panel, Textarea } from '../components/Ui';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { dateTime, shortId } from '../lib/format';
import { useAsyncData } from '../lib/hooks';
import type { ApiItem, ApiList, SosAlert } from '../lib/types';

async function loadSos() {
  return api.get<ApiList<SosAlert>>('/sos?limit=100');
}

export function SosPage() {
  const { data, loading, error, reload } = useAsyncData(loadSos, []);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function resolve(alert: SosAlert) {
    const notes = notesById[alert.id]?.trim();
    if (!notes) {
      setActionError('Resolution notes are required.');
      return;
    }
    setMessage(null);
    setActionError(null);
    try {
      await api.patch<ApiItem<SosAlert>>(`/sos/${alert.id}/resolve`, { resolution_notes: notes });
      setMessage('SOS alert resolved.');
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to resolve SOS alert');
    }
  }

  return (
    <>
      <PageHeader title="SOS alerts" description="Open distress events requiring office attention and resolution notes." />
      <div className="mb-4 space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {actionError ? <Alert tone="error">{actionError}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
      </div>
      {loading ? <Panel>Loading SOS alerts...</Panel> : null}

      <div className="space-y-4">
        {data?.data.length === 0 ? <Panel>No open SOS alerts.</Panel> : null}
        {data?.data.map((alert) => (
          <Panel key={alert.id} className="border-red-100 bg-red-50/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={alert.status ?? 'open'} />
                  <span className="text-sm font-bold text-red-900">SOS {shortId(alert.id)}</span>
                  {alert.job_id ? <span className="text-sm text-red-800">Job {shortId(alert.job_id)}</span> : null}
                </div>
                <p className="mt-3 text-lg font-bold text-red-950">{alert.message ?? alert.notes ?? 'Cleaner needs help'}</p>
                <p className="mt-1 text-sm text-red-800">Triggered {dateTime(alert.triggered_at ?? alert.created_at)}</p>
                {alert.latitude != null || alert.lat != null ? (
                  <p className="mt-1 text-sm text-red-800">
                    Location {alert.latitude ?? alert.lat}, {alert.longitude ?? alert.lng}
                  </p>
                ) : null}
              </div>
              <div className="w-full lg:max-w-md">
                <Field label="Resolution notes">
                  <Textarea
                    rows={3}
                    value={notesById[alert.id] ?? ''}
                    onChange={(event) => setNotesById((current) => ({ ...current, [alert.id]: event.target.value }))}
                    placeholder="Who responded, what happened, and outcome"
                  />
                </Field>
                <Button type="button" className="mt-3" onClick={() => void resolve(alert)}>
                  Resolve alert
                </Button>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
