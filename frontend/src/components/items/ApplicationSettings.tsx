import { Moon, Sun } from 'lucide-react';
import Toggle from '@/components/bits/Toggle';
import { useTheme } from '@/theme/ThemeProvider';

export default function ApplicationSettings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Application Settings
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Customize how the ayo app looks and behaves.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <Toggle
            id="dark-mode-toggle"
            label="Dark Mode"
            description="Switch between light and dark theme."
            checked={theme === 'dark'}
            onChange={toggleTheme}
          />
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            {theme === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            <span>{theme === 'dark' ? 'Dark theme is active' : 'Light theme is active'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
