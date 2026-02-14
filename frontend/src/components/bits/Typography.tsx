import type { HTMLAttributes, ReactNode } from 'react';

type Props = {
  children: ReactNode;
} & HTMLAttributes<HTMLElement>;

export function PageTitle({ children, className = '', ...rest }: Props) {
  return (
    <h1
      {...rest}
      className={`text-2xl font-semibold tracking-tight text-center ${className}`.trim()}
    >
      {children}
    </h1>
  );
}

export function PageSubtitle({ children, className = '', ...rest }: Props) {
  return (
    <p
      {...rest}
      className={`text-sm text-center text-slate-600 dark:text-slate-300 ${className}`.trim()}
    >
      {children}
    </p>
  );
}

export function SectionLabel({ children, className = '', ...rest }: Props) {
  return (
    <h2
      {...rest}
      className={`mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`.trim()}
    >
      {children}
    </h2>
  );
}
