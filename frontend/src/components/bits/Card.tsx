import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export default function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`rounded-3xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm px-8 py-10 shadow-2xl shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-800/90 dark:shadow-slate-900/50 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
