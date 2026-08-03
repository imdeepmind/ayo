import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  isLoading?: boolean;
  children: ReactNode;
};

const baseClasses =
  'inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const primaryClasses =
  'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/40 hover:from-sky-400 hover:to-blue-400 active:from-sky-600 active:to-blue-600 focus:ring-sky-400/50 focus:ring-offset-slate-900 dark:shadow-sky-500/20 dark:hover:shadow-sky-500/30';

const ghostClasses =
  'border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 focus:ring-slate-300/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:hover:border-slate-500 dark:focus:ring-slate-500/50';

export default function Button({
  variant = 'primary',
  fullWidth,
  isLoading,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const variantClasses = variant === 'primary' ? primaryClasses : ghostClasses;
  const widthClasses = fullWidth ? 'w-full' : '';

  return (
    <button
      {...rest}
      disabled={isLoading || rest.disabled}
      className={`${baseClasses} ${variantClasses} ${widthClasses} px-5 py-3 ${className}`.trim()}
    >
      {isLoading ? (
        <>
          <svg
            className="mr-2 h-4 w-4 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Processing...
        </>
      ) : (
        children
      )}
    </button>
  );
}
