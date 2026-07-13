import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/AppShell';
import { Alert, Button, Field, Input, Select } from '../components/Ui';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    timezone: 'Pacific/Auckland',
    jurisdictionCode: 'NZ'
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register');
    } finally {
      setSubmitting(false);
    }
  }

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="ocean-grid min-h-screen text-slate-800">
      <div className="shell-pattern min-h-screen px-5 py-8">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <section>
            <BrandMark />
            <div className="mt-14 max-w-xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-coastal-600">Start the office hub</p>
              <h1 className="mt-5 font-display text-5xl font-bold leading-tight text-coastal-900 sm:text-6xl">
                Bring your business onto CleanOps.
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-700">
                Create the tenant, owner account, default timezone, and tax jurisdiction in one step.
              </p>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/80 bg-white/72 p-6 shadow-soft backdrop-blur-xl sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-coastal-600">Register business</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-coastal-900">Owner account</h2>
            </div>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
              {error ? (
                <div className="sm:col-span-2">
                  <Alert tone="error">{error}</Alert>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <Field label="Business name">
                  <Input value={form.businessName} onChange={(event) => update('businessName', event.target.value)} required />
                </Field>
              </div>
              <Field label="Owner name">
                <Input value={form.ownerName} onChange={(event) => update('ownerName', event.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(event) => update('phone', event.target.value)} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={form.password}
                  minLength={8}
                  onChange={(event) => update('password', event.target.value)}
                  required
                />
              </Field>
              <Field label="Timezone">
                <Select value={form.timezone} onChange={(event) => update('timezone', event.target.value)}>
                  <option value="Pacific/Auckland">Pacific/Auckland</option>
                  <option value="Pacific/Chatham">Pacific/Chatham</option>
                  <option value="UTC">UTC</option>
                </Select>
              </Field>
              <Field label="Tax jurisdiction">
                <Select value={form.jurisdictionCode} onChange={(event) => update('jurisdictionCode', event.target.value)}>
                  <option value="NZ">New Zealand GST</option>
                  <option value="PH">Philippines VAT</option>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Creating workspace...' : 'Create CleanOps workspace'}
                </Button>
              </div>
            </form>
            <p className="mt-6 text-center text-sm text-slate-600">
              Already registered?{' '}
              <Link to="/login" className="font-bold text-coastal-700 hover:text-coastal-900">
                Sign in
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
