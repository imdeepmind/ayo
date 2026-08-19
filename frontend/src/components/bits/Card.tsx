import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export default function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`rounded-3xl border border-border bg-surface px-8 py-10 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
