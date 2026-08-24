import type { ReactNode } from 'react';

import Card from '@/components/bits/Card';
import { PageSubtitle, PageTitle } from '@/components/bits/Typography';

import logo from '@/assets/images/logo.png';

type AuthCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <Card>
      <div className="mb-6 flex justify-center lg:hidden">
        <img src={logo} alt="ayo" className="h-16 w-16 rounded-2xl object-contain" />
      </div>
      <div className="mb-8">
        <PageTitle>{title}</PageTitle>
        {description && <PageSubtitle className="mt-2">{description}</PageSubtitle>}
      </div>
      <div>{children}</div>
      {footer && (
        <div className="mt-6 pt-6 border-t border-border dark:border-border-strong">{footer}</div>
      )}
    </Card>
  );
}
