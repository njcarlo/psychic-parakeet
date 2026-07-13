import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { onForegroundPushMessage, registerPushToken } from '../lib/firebase';
import type { AuthUser } from '../lib/types';

const primaryNavItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/clients', label: 'Clients' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/invoices', label: 'Invoices' }
];

const laterNavItems = [
  { to: '/team', label: 'Team' },
  { to: '/sos', label: 'SOS' },
  { to: '/settings', label: 'Settings' }
];

const pushRoles = new Set(['owner', 'office_admin']);

function canRegisterOfficePush(user: AuthUser | null): boolean {
  return Boolean(user && pushRoles.has(user.role));
}

function showForegroundPushNotification(payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = payload.notification?.title ?? payload.data?.title ?? 'CleanOps alert';
  const body = payload.notification?.body ?? payload.data?.body ?? 'New CleanOps notification';
  new Notification(title, { body });
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-coastal-600 text-lg font-black text-white shadow-soft">
        C
      </div>
      {!compact ? (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-display text-2xl font-bold leading-none text-coastal-900">CleanOps</p>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
              MVP
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-coastal-600">Office</p>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!canRegisterOfficePush(user)) return;

    void registerPushToken(async (token) => {
      await api.post('/devices/push-token', { token, platform: 'web' });
    }).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!canRegisterOfficePush(user)) return undefined;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void onForegroundPushMessage(showForegroundPushNotification).then((nextUnsubscribe) => {
      if (cancelled) nextUnsubscribe?.();
      else unsubscribe = nextUnsubscribe;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  return (
    <div className="ocean-grid min-h-screen text-slate-800">
      <div className="shell-pattern flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/70 bg-white/55 p-5 backdrop-blur-xl lg:block">
          <BrandMark />
          <nav className="mt-8 space-y-1">
            {primaryNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `block rounded-2xl px-4 py-3 text-sm font-bold transition ${
                    isActive ? 'bg-coastal-600 text-white shadow-sm' : 'text-coastal-900 hover:bg-white/80'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="pt-6">
              <p className="px-4 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Later</p>
              <div className="mt-2 space-y-1">
                {laterNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `block rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                        isActive ? 'bg-white text-coastal-800 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-coastal-800'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>
          <div className="mt-8 rounded-3xl border border-coastal-100 bg-white/70 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-coastal-600">Signed in</p>
            <p className="mt-2 font-bold text-coastal-900">{user?.businessName ?? 'CleanOps business'}</p>
            <p className="mt-1 text-sm text-slate-600">{user?.email}</p>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="mt-4 text-sm font-bold text-coastal-700 hover:text-coastal-900"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-white/70 bg-skywash/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between">
              <BrandMark compact />
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="rounded-full bg-white/80 px-3 py-2 text-sm font-bold text-coastal-700"
              >
                Sign out
              </button>
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {[...primaryNavItems, ...laterNavItems].map((item) => {
                const isLater = laterNavItems.some((laterItem) => laterItem.to === item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${
                        isActive ? 'bg-coastal-600 text-white' : isLater ? 'bg-white/50 text-slate-500' : 'bg-white/75 text-coastal-800'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </header>

          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
