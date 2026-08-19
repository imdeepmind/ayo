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
      className={`flex items-center justify-between gap-4 cursor-pointer select-none ${rest.disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`.trim()}
    >
      <div className="flex-1 min-w-0">
        <span className="block text-base font-bold text-text">{label}</span>
        {description && (
          <span className="block text-sm text-text-muted mt-1.5 leading-relaxed">
            {description}
          </span>
        )}
      </div>
      <div className="relative inline-flex h-7 w-12 flex-shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" {...rest} />
        <div className="h-7 w-12 rounded-full border border-border-strong bg-surface-muted transition-all duration-200 peer-checked:border-primary peer-checked:bg-primary peer-focus:ring-4 peer-focus:ring-primary/50 peer-focus:ring-offset-2 peer-focus:ring-offset-white dark:border-border-input dark:bg-surface-muted dark:peer-checked:border-primary dark:peer-checked:bg-primary dark:peer-focus:ring-offset-black shadow-inner" />
        <div className="pointer-events-none absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 peer-checked:translate-x-5" />
      </div>
    </label>
  );
}
