import type { HTMLAttributes, ReactNode } from 'react';

type SectionProps = {
  children: ReactNode;
  size?: 'md' | 'lg';
} & HTMLAttributes<HTMLElement>;

export default function PageSection({
  children,
  size = 'md',
  className = '',
  ...rest
}: SectionProps) {
  const widthClasses = size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <section {...rest} className={`w-full mx-auto ${widthClasses} ${className}`.trim()}>
      {children}
    </section>
  );
}
