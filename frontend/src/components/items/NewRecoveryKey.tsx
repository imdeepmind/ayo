import { useTranslation } from 'react-i18next';

import Button from '@/components/bits/Button';

type NewRecoveryKeyProps = {
  recoveryKey: string;
  isSaving: boolean;
  onDownload: () => void;
};

export default function NewRecoveryKey({ recoveryKey, isSaving, onDownload }: NewRecoveryKeyProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl -mr-16 -mt-16" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {t('auth.yourNewRecoveryKey')}
            </p>
          </div>
          <div className="bg-background rounded-lg p-4 backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-800/50">
            <p className="font-mono text-sm break-all text-text leading-relaxed">{recoveryKey}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 p-5">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">
              {t('auth.oldRecoveryKeyInvalid')}
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200/70 leading-relaxed">
              {t('auth.storeNewRecoveryKey')}
            </p>
          </div>
        </div>
      </div>

      <Button type="button" fullWidth onClick={onDownload} className="mt-2" disabled={isSaving}>
        {isSaving ? t('auth.saving') : t('auth.downloadNewRecoveryKey')}
      </Button>
    </div>
  );
}
