import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Alert, Button, Field, Input, Panel, Select } from '../components/Ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isFirebaseConfigured } from '../lib/firebase';
import { useAsyncData } from '../lib/hooks';
import type { ApiItem, ApiList, TaxJurisdiction } from '../lib/types';

async function loadSettingsData() {
  return api.get<ApiList<TaxJurisdiction>>('/tax/jurisdictions');
}

export function SettingsPage() {
  const { user } = useAuth();
  const { data, loading, error } = useAsyncData(loadSettingsData, []);
  const [timezone, setTimezone] = useState('Pacific/Auckland');
  const [currency, setCurrency] = useState('NZD');
  const [pricingMode, setPricingMode] = useState<'tax_inclusive' | 'tax_exclusive'>('tax_exclusive');
  const [jurisdictionCode, setJurisdictionCode] = useState('NZ');
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pushStatus, setPushStatus] = useState(readPushStatus);

  useEffect(() => {
    const updateStatus = () => setPushStatus(readPushStatus());
    window.addEventListener('focus', updateStatus);
    document.addEventListener('visibilitychange', updateStatus);
    return () => {
      window.removeEventListener('focus', updateStatus);
      document.removeEventListener('visibilitychange', updateStatus);
    };
  }, []);

  async function saveTax(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setActionError(null);
    try {
      await api.patch<ApiItem<{ pricing_mode: string; jurisdiction_code: string }>>('/tax/pricing-mode', {
        pricing_mode: pricingMode,
        jurisdiction_code: jurisdictionCode
      });
      setMessage('Tax pricing mode saved.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save tax settings');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Business defaults, tax jurisdiction, public API planning, and operational preferences."
      />
      <div className="mb-4 space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {actionError ? <Alert tone="error">{actionError}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <h2 className="font-display text-2xl font-bold text-coastal-900">Business profile</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Business">
              <Input value={user?.businessName ?? 'CleanOps business'} readOnly />
            </Field>
            <Field label="Owner/Admin email">
              <Input value={user?.email ?? ''} readOnly />
            </Field>
            <Field label="Timezone">
              <Select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                <option value="Pacific/Auckland">Pacific/Auckland</option>
                <option value="Pacific/Chatham">Pacific/Chatham</option>
                <option value="UTC">UTC</option>
              </Select>
            </Field>
            <Field label="Currency">
              <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                <option value="NZD">NZD</option>
                <option value="PHP">PHP</option>
              </Select>
            </Field>
          </div>
          <p className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm text-slate-600">
            Timezone and currency controls are UI-ready; the API currently exposes tax pricing updates but not a general business settings update route.
          </p>
        </Panel>

        <Panel>
          <h2 className="font-display text-2xl font-bold text-coastal-900">Push notifications</h2>
          <div className="mt-5 rounded-3xl bg-white/70 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Status</p>
            <p className="mt-2 text-lg font-bold text-coastal-900">{pushStatus}</p>
            <p className="mt-2 text-sm text-slate-600">
              {pushStatus === 'not configured'
                ? 'Add the VITE_FIREBASE_* variables to enable FCM registration.'
                : pushStatus === 'enabled'
                  ? 'This browser has granted notification permission for office SOS alerts.'
                  : 'Firebase is configured, but browser notification permission is not enabled.'}
            </p>
          </div>
        </Panel>

        <Panel>
          <h2 className="font-display text-2xl font-bold text-coastal-900">Tax jurisdiction</h2>
          {loading ? <p className="mt-4 text-sm text-slate-600">Loading jurisdictions...</p> : null}
          <form className="mt-5 space-y-4" onSubmit={saveTax}>
            <Field label="Pricing mode">
              <Select value={pricingMode} onChange={(event) => setPricingMode(event.target.value as 'tax_inclusive' | 'tax_exclusive')}>
                <option value="tax_exclusive">Tax exclusive</option>
                <option value="tax_inclusive">Tax inclusive</option>
              </Select>
            </Field>
            <Field label="Jurisdiction">
              <Select value={jurisdictionCode} onChange={(event) => setJurisdictionCode(event.target.value)}>
                {(data?.data.length ? data.data : fallbackJurisdictions).map((jurisdiction) => (
                  <option key={jurisdiction.code ?? jurisdiction.country_code} value={jurisdiction.code ?? jurisdiction.country_code}>
                    {jurisdiction.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save tax settings'}
            </Button>
          </form>
        </Panel>

        <Panel className="xl:col-span-2">
          <h2 className="font-display text-2xl font-bold text-coastal-900">API keys</h2>
          <div className="mt-4 rounded-3xl border border-dashed border-coastal-200 bg-white/60 p-6">
            <p className="font-bold text-coastal-900">Public API key management stub</p>
            <p className="mt-2 text-sm text-slate-600">
              The API supports `/v1` resources with `X-Api-Key`, but no key management endpoint is currently exposed to the office app.
              This area is reserved for creating, revoking, and monitoring tenant API keys.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}

function readPushStatus(): 'enabled' | 'disabled' | 'not configured' {
  if (!isFirebaseConfigured()) return 'not configured';
  if (typeof Notification === 'undefined') return 'disabled';
  return Notification.permission === 'granted' ? 'enabled' : 'disabled';
}

const fallbackJurisdictions: TaxJurisdiction[] = [
  {
    id: 'nz',
    code: 'NZ',
    country_code: 'NZ',
    name: 'New Zealand GST',
    tax_name: 'GST',
    rate_bps: 1500,
    inclusive_label: 'GST inclusive',
    exclusive_label: 'GST exclusive',
    active: true
  }
];
