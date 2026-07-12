import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/clients', label: 'Clients' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/team', label: 'Team' },
  { to: '/sos', label: 'SOS' },
  { to: '/settings', label: 'Settings' }
];

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-coastal-600 text-lg font-black text-white shadow-soft">
        C
      </div>
      {!compact ? (
        <div>
          <p className="font-display text-2xl font-bold leading-none text-coastal-900">CleanOps</p>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-coastal-600">Office</p>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="ocean-grid min-h-screen text-slate-800">
      <div className="shell-pattern flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/70 bg-white/55 p-5 backdrop-blur-xl lg:block">
          <BrandMark />
          <nav className="mt-8 space-y-1">
            {navItems.map((item) => (
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
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${
                      isActive ? 'bg-coastal-600 text-white' : 'bg-white/75 text-coastal-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
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
