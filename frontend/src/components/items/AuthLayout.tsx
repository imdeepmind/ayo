import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import logo from '@/assets/images/logo.png';

type AuthLayoutProps = {
  children: ReactNode;
};

const features = [
  {
    icon: ShieldCheck,
    titleKey: 'auth.brandFeature1Title',
    descriptionKey: 'auth.brandFeature1Description',
  },
  {
    icon: KeyRound,
    titleKey: 'auth.brandFeature2Title',
    descriptionKey: 'auth.brandFeature2Description',
  },
  {
    icon: Lock,
    titleKey: 'auth.brandFeature3Title',
    descriptionKey: 'auth.brandFeature3Description',
  },
];

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full w-full">
      <div className="grid h-full lg:grid-cols-2">
        <aside className="hidden min-h-0 flex-col justify-between overflow-hidden bg-surface-alt p-10 lg:flex [--wails-draggable:drag]">
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex justify-center">
              <img src={logo} alt="ayo" className="h-36 w-36 rounded-2xl object-contain" />
            </div>

            <h1 className="text-4xl font-bold leading-tight text-text">
              {t('auth.brandHeadline')}
            </h1>

            <ul className="mt-8 space-y-5">
              {features.map(({ icon: Icon, titleKey, descriptionKey }) => (
                <li key={titleKey} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-text">{t(titleKey)}</p>
                    <p className="mt-0.5 text-sm text-text-muted">{t(descriptionKey)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-text-faint">{t('auth.brandFooter')}</p>
        </aside>

        <main className="flex min-h-0 overflow-y-auto p-6 sm:p-10 [--wails-draggable:drag]">
          <div className="m-auto w-full max-w-md [--wails-draggable:no-drag]">{children}</div>
        </main>
      </div>
    </div>
  );
}
