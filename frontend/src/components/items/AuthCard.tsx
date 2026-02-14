import type { ReactNode } from 'react';
import Card from '@/components/bits/Card';
import { PageSubtitle, PageTitle } from '@/components/bits/Typography';

type AuthCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <Card>
      <div className="mb-6">
        <PageTitle>{title}</PageTitle>
        {description && <PageSubtitle className="mt-1">{description}</PageSubtitle>}
      </div>
      <div>{children}</div>
      {footer && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">{footer}</div>
      )}
    </Card>
  );
}
