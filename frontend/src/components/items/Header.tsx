import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Search, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSearch } from '@/context/SearchContext';
import logo from '@/assets/images/logo.png';

export default function Header() {
  const { session, logout } = useAuth();
  const { query, setQuery, clear } = useSearch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/');
  };

  const handleAccountSettings = () => {
    setMenuOpen(false);
    navigate('/settings');
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    clear();
    navigate('/auth/login');
  };

  return (
    <header className="w-full shrink-0 bg-background py-6 px-8 md:px-10">
      <div className="flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <Link to="/" className="flex items-center shrink-0">
          <img src={logo} alt="ayo" className="h-12 w-12 rounded-lg" />
        </Link>

        {/* Central Search Drive Input (Only visible when logged in) */}
        {session ? (
          <form onSubmit={handleSubmit} className="flex-1 max-w-xl mx-6" role="search">
            <div className="relative w-full">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-text-faint">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="search"
                aria-label="Search Drive"
                placeholder="Search Drive"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-full border border-border bg-surface-alt/90 py-3 pl-11 pr-5 text-sm text-text placeholder:text-text-faint outline-none transition focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-strong dark:bg-surface-alt dark:text-text dark:focus:bg-surface"
              />
            </div>
          </form>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right Header Icons */}
        <div className="flex items-center gap-3 shrink-0">
          {/* User Profile Avatar */}
          {session ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-white text-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Open account menu"
                aria-expanded={menuOpen}
              >
                {session.Username ? session.Username.charAt(0).toUpperCase() : 'U'}
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 z-50 mt-3 w-56 overflow-hidden rounded-xl border-2 border-border bg-background shadow-2xl shadow-black/10 dark:border-border-strong">
                    <div className="border-b-2 border-border px-4 py-3 dark:border-border-strong">
                      <p className="truncate text-sm font-bold text-text">{session.Username}</p>
                      <p className="truncate text-xs text-text-faint">
                        Signed in as {session.Username}
                      </p>
                    </div>
                    <nav className="flex flex-col gap-1 p-1.5">
                      <button
                        type="button"
                        onClick={handleAccountSettings}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-text-muted transition hover:bg-surface-hover hover:text-text dark:text-text-muted dark:hover:bg-surface-hover dark:hover:text-text"
                      >
                        <Settings className="h-4 w-4 shrink-0" />
                        Account Settings
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-text-muted transition hover:bg-surface-hover hover:text-text dark:text-text-muted dark:hover:bg-surface-hover dark:hover:text-text"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        Logout
                      </button>
                    </nav>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link to="/auth/login" className="text-sm font-semibold text-primary hover:underline">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
