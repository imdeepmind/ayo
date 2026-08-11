import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSearch } from '@/context/SearchContext';
import logo from '@/assets/images/logo.png';

export default function Header() {
  const { session } = useAuth();
  const { query, setQuery } = useSearch();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/');
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
