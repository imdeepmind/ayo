import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
};

const baseClasses =
  'inline-flex items-center justify-center rounded-lg text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2';

const primaryClasses =
  'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/40 hover:bg-sky-400 active:bg-sky-600 focus:ring-sky-400 focus:ring-offset-slate-900';

const ghostClasses =
  'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:ring-slate-500';

export function Button({ variant = 'primary', fullWidth, className = '', children, ...rest }: ButtonProps) {
  const variantClasses = variant === 'primary' ? primaryClasses : ghostClasses;
  const widthClasses = fullWidth ? 'w-full' : '';

  return (
    <button
      {...rest}
      className={`${baseClasses} ${variantClasses} ${widthClasses} px-4 py-2 ${className}`.trim()}
    >
      {children}
    </button>
  );
}

