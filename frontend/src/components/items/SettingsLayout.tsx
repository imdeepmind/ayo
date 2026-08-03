import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';

export type SettingsSection = {
  id: string;
  label: string;
  icon: ReactNode;
};

type SettingsLayoutProps = {
  sections: SettingsSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  children: ReactNode;
};

export default function SettingsLayout({
  sections,
  activeSection,
  onSectionChange,
  children,
}: SettingsLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSelect = (id: string) => {
    onSectionChange(id);
    setDrawerOpen(false);
  };

  return (
    <div className="mx-auto w-full px-4 pt-8 pb-16 md:px-8 lg:px-16">
      {/* Mobile drawer toggle */}
      <div className="mb-6 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen((o) => !o)}
          className="inline-flex items-center gap-2.5 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-lg transition-all hover:bg-slate-50 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Toggle settings menu"
        >
          <Menu className="h-4 w-4" />
          Settings Menu
        </button>
      </div>

      <div className="flex gap-8">
        {/* Overlay for mobile */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-72 border-r-2 border-slate-200 bg-white/95 pt-20 backdrop-blur-sm transition-transform duration-200 dark:border-slate-700 dark:bg-slate-900/95
            lg:static lg:z-auto lg:w-64 lg:flex-shrink-0 lg:rounded-3xl lg:border-2 lg:pt-0 lg:backdrop-blur-none lg:shadow-2xl lg:shadow-slate-200/50 lg:dark:shadow-slate-900/50
            ${drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `.trim()}
        >
          <nav className="flex flex-col gap-1.5 p-4">
            <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Settings
            </p>
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s.id)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-200
                  ${
                    activeSection === s.id
                      ? 'bg-gradient-to-r from-sky-50 to-blue-50 text-sky-600 shadow-sm border-2 border-sky-200 dark:from-sky-950/40 dark:to-blue-950/40 dark:border-sky-800 dark:text-sky-400'
                      : 'text-slate-600 hover:bg-slate-50 border-2 border-transparent hover:border-slate-200 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:border-slate-700'
                  }
                `}
              >
                <span className="text-base">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
