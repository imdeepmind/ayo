import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export default function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`rounded-2xl border border-slate-200 bg-white/80 px-6 py-8 shadow-lg dark:border-slate-700 dark:bg-slate-800/80 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

