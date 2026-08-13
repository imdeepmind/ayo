import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  'aria-label': string;
};

const baseClasses =
  'inline-flex items-center justify-center rounded-full border border-border-strong bg-surface-alt text-text-muted shadow-sm transition hover:bg-surface-hover hover:text-text focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background dark:border-border-input dark:bg-surface-alt dark:text-text-muted dark:hover:bg-surface-hover';

export default function IconButton({ className = '', children, ...rest }: IconButtonProps) {
  return (
    <button {...rest} className={`${baseClasses} h-8 w-8 text-sm ${className}`.trim()}>
      {children}
    </button>
  );
}
