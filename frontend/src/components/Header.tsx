import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../theme/ThemeProvider';

const navLinkBase =
  'text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:text-sky-500';

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tracking-tight">ayo</span>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              beta
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-1">
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
        </nav>

        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-400 dark:hover:text-sky-300"
        >
          <span aria-hidden="true">{theme === 'dark' ? '🌙' : '☀️'}</span>
          <span className="hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'} mode</span>
        </button>
      </div>
    </header>
  );
}

