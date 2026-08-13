import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  isLoading?: boolean;
  children: ReactNode;
};

const baseClasses =
  'inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

const primaryClasses =
  'bg-primary text-white hover:bg-primary-hover active:bg-primary-active focus:ring-primary/50 dark:bg-primary dark:hover:bg-primary-hover';

const ghostClasses =
  'border border-border bg-surface-alt text-text hover:bg-surface-muted/80 focus:ring-border-strong/50 dark:border-border-strong dark:bg-surface-alt dark:text-text dark:hover:bg-surface-hover';

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
