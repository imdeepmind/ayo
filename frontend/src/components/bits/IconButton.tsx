import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  'aria-label': string;
};

const baseClasses =
  'inline-flex items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

export default function IconButton({ className = '', children, ...rest }: IconButtonProps) {
  return (
    <button {...rest} className={`${baseClasses} h-8 w-8 text-sm ${className}`.trim()}>
      {children}
    </button>
  );
}
