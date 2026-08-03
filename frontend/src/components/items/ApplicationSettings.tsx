import { Moon, Sun } from 'lucide-react';
import Toggle from '@/components/bits/Toggle';
import { useTheme } from '@/theme/ThemeProvider';

export default function ApplicationSettings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Application Settings
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Customize how the ayo app looks and behaves.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800/90">
          <Toggle
            id="dark-mode-toggle"
            label="Dark Mode"
            description="Switch between light and dark theme."
            checked={theme === 'dark'}
            onChange={toggleTheme}
          />
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-2 border-slate-100 dark:border-slate-700">
            {theme === 'dark' ? (
              <Moon className="h-4 w-4 text-sky-500" />
            ) : (
              <Sun className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {theme === 'dark' ? 'Dark theme is active' : 'Light theme is active'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
