import { Link, NavLink } from 'react-router-dom';
import Button from '@/components/bits/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/context/AuthContext';

const navLinkBase =
  'text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:text-sky-500';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { session, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 w-full mb-4">
      <div className="mx-auto flex h-14 w-full items-center justify-between px-4 md:px-8 lg:px-16">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tracking-tight">ayo</span>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              beta
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-1">
          {session ? (
            <NavLink
              to="/"
              className={({ isActive }) =>
                [
                  navLinkBase,
                  isActive
                    ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-slate-800'
                    : 'text-slate-600 dark:text-slate-300',
                ].join(' ')
              }
            >
              Home
            </NavLink>
          ) : (
            <NavLink
              to="/auth/login"
              className={({ isActive }) =>
                [
                  navLinkBase,
                  isActive
                    ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-slate-800'
                    : 'text-slate-600 dark:text-slate-300',
                ].join(' ')
              }
            >
              Login
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={toggleTheme}
            className="h-8 px-3 text-xs"
          >
            <span aria-hidden="true" className="mr-1">
              {theme === 'dark' ? '🌙' : '☀️'}
            </span>
            <span className="hidden sm:inline">
              {theme === 'dark' ? 'Dark' : 'Light'} mode
            </span>
          </Button>

          {session && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => logout()}
              className="h-8 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-950/30"
            >
              Log out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

