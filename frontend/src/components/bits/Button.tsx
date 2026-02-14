import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  isLoading?: boolean;
  children: ReactNode;
};

const baseClasses =
  'inline-flex items-center justify-center rounded-lg text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2';

const primaryClasses =
  'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/40 hover:bg-sky-400 active:bg-sky-600 focus:ring-sky-400 focus:ring-offset-slate-900';

const ghostClasses =
  'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:ring-slate-500';

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
      className={`${baseClasses} ${variantClasses} ${widthClasses} px-4 py-2 ${className} ${
        isLoading ? 'opacity-70 cursor-not-allowed' : ''
      }`.trim()}
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
