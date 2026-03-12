import type { InputHTMLAttributes } from 'react';

type ToggleProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  id: string;
  description?: string;
};

export default function Toggle({ label, id, description, className = '', ...rest }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center justify-between gap-3 cursor-pointer select-none ${rest.disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`.trim()}
    >
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </span>
        {description && (
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {description}
          </span>
        )}
      </div>
      <div className="relative inline-flex h-6 w-11 flex-shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" {...rest} />
        <div className="h-6 w-11 rounded-full border border-slate-300 bg-slate-200 transition-colors peer-checked:border-sky-500 peer-checked:bg-sky-500 peer-focus:ring-2 peer-focus:ring-sky-400 peer-focus:ring-offset-2 peer-focus:ring-offset-white dark:border-slate-600 dark:bg-slate-700 dark:peer-focus:ring-offset-slate-900" />
        <div className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </div>
    </label>
  );
}
