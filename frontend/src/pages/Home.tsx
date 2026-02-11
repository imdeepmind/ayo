import logo from '../assets/images/logo-universal.png';

export default function Home() {
  return (
    <section className="w-full max-w-2xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-8 shadow-lg dark:border-slate-700 dark:bg-slate-800/80">
        <div className="flex flex-col items-center gap-4 mb-6">
          <img
            src={logo}
            alt="ayo logo"
            className="w-20 h-20 object-contain drop-shadow-[0_0_25px_rgba(56,189,248,0.55)]"
          />
          <h1 className="text-3xl font-semibold tracking-tight">
            ayo <span className="text-sky-500">file server</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md text-center">
            A minimal starter home page. Use the navigation above to explore the auth flows.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/40">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Status
            </h2>
            <p>Routing & Tailwind are wired up.</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/40">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Auth
            </h2>
            <p>Try the Login, Register, and Reset pages.</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/40">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Theme
            </h2>
            <p>Use the header toggle to switch dark / light.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

