import { KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/bits/Button';
import WarningBanner from '@/components/bits/WarningBanner';

type NewRecoveryKeyProps = {
  recoveryKey: string;
  isSaving: boolean;
  onDownload: () => void;
  variant?: 'reset' | 'register';
};

export default function NewRecoveryKey({
  recoveryKey,
  isSaving,
  onDownload,
  variant = 'reset',
}: NewRecoveryKeyProps) {
  const { t } = useTranslation();
  const isRegister = variant === 'register';
  const title = t(isRegister ? 'auth.yourRecoveryKey' : 'auth.yourNewRecoveryKey');
  const warningTitle = t(isRegister ? 'auth.storeKeySecurely' : 'auth.oldRecoveryKeyInvalid');
  const warningBody = t(isRegister ? 'auth.recoveryKeyWarning' : 'auth.storeNewRecoveryKey');
  const buttonLabel = t(isRegister ? 'auth.downloadRecoveryKey' : 'auth.downloadNewRecoveryKey');

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 dark:border-border-strong">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-primary/10 p-2.5 dark:bg-primary/20">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-text">{title}</p>
          </div>
          <div className="rounded-lg bg-surface-alt border border-border p-4">
            <p className="font-mono text-sm text-text break-all leading-relaxed">{recoveryKey}</p>
          </div>
        </div>
      </div>

      <WarningBanner title={warningTitle} description={warningBody} />

      <Button type="button" fullWidth onClick={onDownload} className="mt-2" disabled={isSaving}>
        {isSaving ? t('auth.saving') : buttonLabel}
      </Button>
    </div>
  );
}
