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
    <div className="mx-auto w-full px-4 pt-6 pb-10 md:px-8 lg:px-16">
      {/* Mobile drawer toggle */}
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Toggle settings menu"
        >
          <Menu className="h-4 w-4" />
          Settings Menu
        </button>
      </div>

      <div className="flex gap-6">
        {/* Overlay for mobile */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white/95 pt-20 backdrop-blur-sm transition-transform duration-200 dark:border-slate-700 dark:bg-slate-900/95
            lg:static lg:z-auto lg:w-56 lg:flex-shrink-0 lg:rounded-xl lg:border lg:pt-0 lg:backdrop-blur-none
            ${drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `.trim()}
        >
          <nav className="flex flex-col gap-1 p-3">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Settings
            </p>
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s.id)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition
                  ${
                    activeSection === s.id
                      ? 'bg-sky-50 text-sky-600 dark:bg-slate-800 dark:text-sky-400'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
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
