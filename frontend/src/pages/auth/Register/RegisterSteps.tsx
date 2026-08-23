import { useTranslation } from 'react-i18next';

type RegisterStepsProps = {
  step: 1 | 2;
};

export default function RegisterSteps({ step }: RegisterStepsProps) {
  const { t } = useTranslation();

  const stepClass = (active: boolean) => (active ? 'text-primary' : 'text-text-faint');

  return (
    <div className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold">
      <span className={stepClass(step === 1)}>{t('auth.stepAccountDetails')}</span>
      <span className="text-border-strong">—</span>
      <span className={stepClass(step === 2)}>{t('auth.stepDatabaseConfiguration')}</span>
    </div>
  );
}
