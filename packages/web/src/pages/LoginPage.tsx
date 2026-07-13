import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/AppShell';
import { Alert, Button, Field, Input } from '../components/Ui';
import { useAuth } from '../context/AuthContext';

const demoEmail = 'admin@harbourshine.nz';
const demoPassword = 'password123';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(demoEmail);
  const [password, setPassword] = useState(demoPassword);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
      const target = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="ocean-grid min-h-screen text-slate-800">
      <div className="shell-pattern min-h-screen px-5 py-8">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <BrandMark />
            <div className="mt-16 max-w-3xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-coastal-600">CleanOps MVP</p>
              <h1 className="mt-5 font-display text-6xl font-bold leading-[0.95] text-coastal-900 sm:text-7xl">
                Run today&apos;s cleans with confidence.
              </h1>
              <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-700">
                A focused office command centre for clients, schedules, cleaner assignments, and invoicing.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-coastal-800">
                <span className="rounded-full bg-white/70 px-4 py-2">Deep teal operations</span>
                <span className="rounded-full bg-white/70 px-4 py-2">Sky-wash schedules</span>
                <span className="rounded-full bg-white/70 px-4 py-2">Built for cleaning teams</span>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/80 bg-white/70 p-6 shadow-soft backdrop-blur-xl sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-coastal-600">Office sign in</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-coastal-900">Harbour Shine demo</h2>
            </div>
            <div className="mb-5 rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-950">
              <p className="font-black uppercase tracking-[0.18em] text-emerald-700">Demo credentials</p>
              <div className="mt-3 space-y-2">
                <p>
                  <span className="font-bold">Office demo:</span> {demoEmail} / {demoPassword}
                </p>
                <p>
                  <span className="font-bold">Cleaner app:</span> use the mobile app with mia@harbourshine.nz / {demoPassword}
                </p>
              </div>
            </div>
            <form className="space-y-4" onSubmit={onSubmit}>
              {error ? <Alert tone="error">{error}</Alert> : null}
              <Field label="Email">
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Signing in...' : 'Sign in to CleanOps'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-600">
              New cleaning business?{' '}
              <Link to="/register" className="font-bold text-coastal-700 hover:text-coastal-900">
                Register your office
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
