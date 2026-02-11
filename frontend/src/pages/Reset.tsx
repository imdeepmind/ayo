import { FormEvent, useRef, useState } from 'react';

export default function Reset() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setMessage('Please provide a recovery key file.');
      return;
    }

    setMessage('Password reset requested (demo only, no backend yet).');
  };

  return (
    <section className="w-full max-w-md mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-8 shadow-lg dark:border-slate-700 dark:bg-slate-800/80">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-center">Reset password</h1>
        <p className="mb-6 text-sm text-center text-slate-600 dark:text-slate-300">
          Provide your username, recovery key file, and a new password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="reset-username" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Username
            </label>
            <input
              id="reset-username"
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
            <label htmlFor="recovery-file" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Recovery key file
            </label>
            <input
              id="recovery-file"
              name="recovery-file"
              type="file"
              ref={fileInputRef}
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0
                         file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium
                         file:text-slate-800 hover:file:bg-slate-200 dark:text-slate-300
                         dark:file:bg-slate-900 dark:file:text-slate-100 dark:hover:file:bg-slate-800"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="reset-password" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              New password
            </label>
            <input
              id="reset-password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900
                         placeholder:text-slate-400 shadow-sm outline-none transition
                         focus:border-sky-500 focus:ring-2 focus:ring-sky-500 dark:border-slate-600
                         dark:bg-slate-900/70 dark:text-slate-100"
              placeholder="Enter a new password"
            />
          </div>

          {message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-sm
                       font-medium text-slate-950 shadow-md shadow-sky-500/40 transition
                       hover:bg-sky-400 active:bg-sky-600 focus:outline-none focus:ring-2
                       focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Submit reset request
          </button>
        </form>
      </div>
    </section>
  );
}

