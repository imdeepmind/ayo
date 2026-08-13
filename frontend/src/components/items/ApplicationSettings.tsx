import { Moon, Sun } from 'lucide-react';
import Toggle from '@/components/bits/Toggle';
import { useTheme } from '@/theme/ThemeProvider';

export default function ApplicationSettings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text">Application Settings</h2>
        <p className="mt-2 text-sm text-text-muted">Customize how the ayo app looks and behaves.</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border-2 border-border bg-background backdrop-blur-sm p-6 shadow-lg dark:border-border-strong">
          <Toggle
            id="dark-mode-toggle"
            label="Dark Mode"
            description="Switch between light and dark theme."
            checked={theme === 'dark'}
            onChange={toggleTheme}
          />
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-surface-hover dark:bg-surface px-4 py-3 border-2 border-border dark:border-border-strong">
            {theme === 'dark' ? (
              <Moon className="h-4 w-4 text-primary" />
            ) : (
              <Sun className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm font-medium text-text-muted dark:text-text">
              {theme === 'dark' ? 'Dark theme is active' : 'Light theme is active'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
