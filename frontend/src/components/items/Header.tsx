import { Link } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type HeaderProps = {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
};

export default function Header({ searchQuery = '', onSearchChange }: HeaderProps) {
  const { session } = useAuth();

  return (
    <header className="w-full shrink-0 bg-background py-6 px-8 md:px-10">
      <div className="flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-alt dark:bg-surface-alt">
            {/* Google Drive inspired triangle logo icon */}
            <svg
              className="h-7 w-7"
              viewBox="0 0 87.3 78"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M6.6 66.85L25.35 34.35H77.1L58.35 66.85H6.6Z" fill="#0066DA" />
              <path
                d="M43.65 11.15L62.4 43.65L30.9 76.15L12.15 43.65L43.65 11.15Z"
                fill="#00AC47"
              />
              <path d="M43.65 11.15L62.4 43.65H77.1L58.35 11.15H43.65Z" fill="#EA4335" />
              <path d="M25.35 34.35L6.6 66.85H21.3L40.05 34.35H25.35Z" fill="#FFBA00" />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight text-text">ayo</span>
        </Link>

        {/* Central Search Drive Input (Only visible when logged in) */}
        {session ? (
          <div className="flex-1 max-w-xl mx-6">
            <div className="relative w-full">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-text-faint">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="search"
                aria-label="Search Drive"
                placeholder="Search Drive"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full rounded-full border border-border bg-surface-alt/90 py-3 pl-11 pr-5 text-sm text-text placeholder:text-text-faint outline-none transition focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-strong dark:bg-surface-alt dark:text-text dark:focus:bg-surface"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right Header Icons */}
        <div className="flex items-center gap-3 shrink-0">
          {session && (
            <button
              type="button"
              className="relative rounded-full p-2 text-text-subtle hover:bg-surface-alt hover:text-text dark:text-text-subtle dark:hover:bg-surface-alt dark:hover:text-text transition"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>
          )}

          {/* User Profile Avatar */}
          {session ? (
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-white text-sm">
                {session.Username ? session.Username.charAt(0).toUpperCase() : 'U'}
              </div>
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
