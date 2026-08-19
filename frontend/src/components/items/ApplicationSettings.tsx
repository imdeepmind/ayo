import { Moon, Sun, Check } from 'lucide-react';
import { useTheme } from '@/theme/ThemeProvider';

function ThemeSwatch({
  active,
  dark,
  onClick,
}: {
  active: boolean;
  dark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex-1 cursor-pointer rounded-xl border-2 p-2 text-left transition-all duration-200 ${
        active
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border dark:border-border-strong hover:border-primary/50'
      }`}
    >
      <div
        className={`overflow-hidden rounded-lg border border-border-strong ${dark ? 'bg-slate-900' : 'bg-white'}`}
      >
        <div className="flex items-center gap-1.5 border-b border-border-strong px-2 py-1.5">
          <span className={`h-2 w-2 rounded-full ${dark ? 'bg-red-500' : 'bg-red-400'}`} />
          <span className={`h-2 w-2 rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
          <span className={`h-2 w-2 rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
        </div>
        <div className="flex">
          <div className={`w-6 bg-primary`} />
          <div className={`flex-1 space-y-1.5 p-1.5 ${dark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className={`h-1.5 w-3/4 rounded ${dark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <div className={`h-1.5 w-1/2 rounded ${dark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <div className={`h-1.5 w-2/3 rounded ${dark ? 'bg-slate-800' : 'bg-slate-100'}`} />
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {dark ? (
          <Moon className="h-3.5 w-3.5 text-text-subtle" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
        <span className="text-xs font-semibold text-text-muted">{dark ? 'Dark' : 'Light'}</span>
        {active && <Check className="h-3.5 w-3.5 text-primary" />}
      </div>
    </button>
  );
}

export default function ApplicationSettings() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="rounded-2xl border border-border bg-surface backdrop-blur-sm dark:border-border-strong">
      <div className="p-6">
        <h3 className="text-base font-bold text-text">Appearance</h3>
        <p className="mt-1 text-sm text-text-muted">Choose how ayo looks on your device.</p>

        <div className="mt-5 flex items-center gap-3">
          <ThemeSwatch active={!isDark} dark={false} onClick={() => setTheme('light')} />
          <ThemeSwatch active={isDark} dark onClick={() => setTheme('dark')} />
        </div>
      </div>
    </div>
  );
}
