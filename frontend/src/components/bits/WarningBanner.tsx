import { AlertTriangle, type LucideIcon } from 'lucide-react';

type WarningBannerProps = {
  title: string;
  description: string;
  variant?: 'warning' | 'info';
  icon?: LucideIcon;
  className?: string;
};

// WarningBanner is the shared amber/primary notice used across settings pages.
// The icon sits top-aligned (items-start + shrink-0) so it never stretches.
export default function WarningBanner({
  title,
  description,
  variant = 'warning',
  icon: Icon,
  className = '',
}: WarningBannerProps) {
  const isWarning = variant === 'warning';

  return (
    <div
      className={`rounded-2xl border p-6 ${
        isWarning
          ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 dark:border-amber-500/25 dark:from-amber-500/10 dark:to-amber-500/10'
          : 'border-primary/20 bg-gradient-to-br from-primary/5 to-primary/5 dark:border-primary/40 dark:from-primary/10 dark:to-primary/10'
      } ${className}`.trim()}
    >
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 rounded-xl p-2.5 ${
            isWarning ? 'bg-amber-100 dark:bg-amber-500/15' : 'bg-primary/10 dark:bg-primary/20'
          }`}
        >
          {Icon ? (
            <Icon
              className={`h-5 w-5 ${isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}
            />
          ) : (
            <AlertTriangle
              className={`h-5 w-5 ${isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}
            />
          )}
        </div>
        <div className="flex-1">
          <p
            className={`text-base font-bold ${
              isWarning ? 'text-amber-900 dark:text-amber-300' : 'text-text'
            }`}
          >
            {title}
          </p>
          <p
            className={`mt-2 text-sm leading-relaxed ${
              isWarning ? 'text-amber-800 dark:text-amber-200/70' : 'text-text-muted'
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
