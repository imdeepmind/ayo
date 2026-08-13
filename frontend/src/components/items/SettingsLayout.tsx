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
          className="inline-flex items-center gap-2.5 rounded-xl border-2 border-border bg-surface-alt px-4 py-2.5 text-sm font-semibold text-text-muted shadow-lg transition-all hover:bg-surface-hover hover:border-border-strong dark:border-border-input dark:bg-surface-alt dark:text-text dark:hover:bg-surface-hover"
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
            fixed inset-y-0 left-0 z-40 w-72 border-r-2 border-border bg-background pt-20 backdrop-blur-sm transition-transform duration-200 dark:border-border-strong
            lg:static lg:z-auto lg:w-64 lg:flex-shrink-0 lg:rounded-3xl lg:border-2 lg:pt-0 lg:backdrop-blur-none lg:shadow-2xl lg:shadow-border/50
            ${drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `.trim()}
        >
          <nav className="flex flex-col gap-1.5 p-4">
            <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-text-faint dark:text-text-subtle">
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
                      ? 'bg-gradient-to-r from-primary/5 to-primary/5 text-primary shadow-sm border-2 border-primary/20 dark:from-primary/10 dark:to-primary/10 dark:border-primary/40 dark:text-primary'
                      : 'text-text-muted hover:bg-surface-hover border-2 border-transparent hover:border-border dark:text-text-muted dark:hover:bg-surface-hover dark:hover:border-border-strong'
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
