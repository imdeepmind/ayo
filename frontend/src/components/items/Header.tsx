import { LogOut, Search, Settings } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { useSearch } from '@/context/SearchContext';

export default function Header() {
  const { t } = useTranslation();
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
    <header className="w-full h-10 shrink-0 bg-background pl-[75px] pr-4 [--wails-draggable:drag] select-none">
      <div className="flex h-full items-center justify-between gap-4">
        {/* Central Search Drive Input (Only visible when logged in) */}
        {session ? (
          <>
            {/* Spacer mirroring the avatar so the search bar stays centered */}
            <div className="w-8 shrink-0" aria-hidden="true" />
            <form
              onSubmit={handleSubmit}
              className="flex-1 max-w-xl mx-auto px-2 [--wails-draggable:no-drag]"
              role="search"
            >
              <div className="relative w-full">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-text-faint">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="search"
                  aria-label={t('header.searchDrive')}
                  placeholder={t('header.searchDrive')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-7 w-full rounded-full border border-border bg-surface-alt/90 pl-10 pr-4 text-sm text-text placeholder:text-text-faint outline-none transition focus:bg-surface focus:outline-2 focus:outline-solid focus:outline-offset-1 focus:outline-primary dark:border-border-strong dark:bg-surface-alt dark:text-text dark:focus:bg-surface"
                />
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right Header Icons */}
        <div className="flex shrink-0 items-center gap-3">
          {/* User Profile Avatar */}
          {session && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-primary font-bold text-white text-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40 [--wails-draggable:no-drag]"
                aria-label={t('header.openAccountMenu')}
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
                  <div className="absolute right-0 z-50 mt-3 w-56 overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-2xl dark:border-border-strong [--wails-draggable:no-drag]">
                    <div className="border-b border-border px-4 py-3 dark:border-border-strong">
                      <p className="truncate text-sm font-bold text-text">{session.Username}</p>
                      <p className="truncate text-xs text-text-faint">
                        {t('header.signedInAs', { username: session.Username })}
                      </p>
                    </div>
                    <nav className="flex flex-col gap-1 p-1.5">
                      <button
                        type="button"
                        onClick={handleAccountSettings}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-text-muted transition hover:bg-surface-hover hover:text-text dark:text-text-muted dark:hover:bg-surface-hover dark:hover:text-text"
                      >
                        <Settings className="h-4 w-4 shrink-0" />
                        {t('header.accountSettings')}
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-text-muted transition hover:bg-surface-hover hover:text-text dark:text-text-muted dark:hover:bg-surface-hover dark:hover:text-text"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {t('header.logout')}
                      </button>
                    </nav>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
