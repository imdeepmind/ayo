import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (username === 'admin' && password === 'password') {
      navigate('/');
    } else {
      setError('Invalid username or password. Try admin / password.');
    }
  };

  return (
    <section className="w-full max-w-md mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-8 shadow-lg dark:border-slate-700 dark:bg-slate-800/80">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-center">Login</h1>
        <p className="mb-6 text-sm text-center text-slate-600 dark:text-slate-300">
          Use the demo credentials <span className="font-mono">admin / password</span> to sign in.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900
                         placeholder:text-slate-400 shadow-sm outline-none transition
                         focus:border-sky-500 focus:ring-2 focus:ring-sky-500 dark:border-slate-600
                         dark:bg-slate-900/70 dark:text-slate-100"
              placeholder="Enter your username"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900
                         placeholder:text-slate-400 shadow-sm outline-none transition
                         focus:border-sky-500 focus:ring-2 focus:ring-sky-500 dark:border-slate-600
                         dark:bg-slate-900/70 dark:text-slate-100"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-sm
                       font-medium text-slate-950 shadow-md shadow-sky-500/40 transition
                       hover:bg-sky-400 active:bg-sky-600 focus:outline-none focus:ring-2
                       focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Sign in
          </button>
        </form>
        <div className="mt-4 flex flex-col items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 sm:flex-row">
          <div className="flex gap-2">
            <span>New here?</span>
            <Link
              to="/auth/register"
              className="font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
            >
              Create an account
            </Link>
          </div>
          <Link
            to="/auth/reset"
            className="font-medium text-slate-600 underline underline-offset-4 hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-300"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </section>
  );
}

