import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

import { toErrorMessage } from '@/lib/errors';
import type { RegisterFormData } from '@/lib/validations';

import AuthCard from '@/components/items/AuthCard';
import AuthLayout from '@/components/items/AuthLayout';
import NewRecoveryKey from '@/components/items/NewRecoveryKey';

import AccountDetailsForm from './AccountDetailsForm';
import DatabaseConfig, { type DatabaseConfigData } from './DatabaseConfig';
import RegisterSteps from './RegisterSteps';

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register: registerUser, saveRecoveryKey } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [accountData, setAccountData] = useState<RegisterFormData | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1: account details. On success, move to database configuration.
  const onAccountSubmit = (data: RegisterFormData) => {
    setAccountData(data);
    setStep(2);
  };

  // Step 2: database configuration. Combine with the account details and call
  // the backend; SQLite paths are auto-generated so Path is left empty.
  const onDatabaseComplete = async (dbData: DatabaseConfigData) => {
    if (!accountData) return;

    try {
      const result = await registerUser({
        username: accountData.username,
        password: accountData.password,
        dbConfig: dbData,
      });
      if (result) {
        setRecoveryKey(result.RecoveryKey);
        toast.success(t('auth.accountCreated'));
      } else {
        toast.error(t('auth.accountCreateFailed'));
      }
    } catch (err) {
      console.error('Registration error:', err);
      toast.error(toErrorMessage(err, t('common.unexpectedError')));
    }
  };

  const handleDownloadRecoveryKey = async () => {
    if (!recoveryKey || !accountData) return;

    setIsSaving(true);
    try {
      await saveRecoveryKey(accountData.username, recoveryKey);
      // The key is only ever shown once; drop the reference as soon as the
      // save completes so the JS heap copy is released promptly.
      setRecoveryKey(null);
      setAccountData(null);
      toast.success(t('auth.recoveryKeySaved'));
      navigate('/auth/login');
    } catch (err) {
      console.error('Failed to save recovery key:', err);
      toast.error(t('auth.recoveryKeySaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title={recoveryKey ? t('auth.saveRecoveryKeyTitle') : t('auth.createAccountTitle')}
        description={
          recoveryKey
            ? t('auth.createAccountRecoveryDescription')
            : t('auth.createAccountDescription')
        }
        footer={
          !recoveryKey &&
          step === 1 && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-text-muted">
              <span>{t('auth.alreadyHaveAccount')}</span>
              <Link
                to="/auth/login"
                className="font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                {t('auth.signInArrow')}
              </Link>
            </div>
          )
        }
      >
        {recoveryKey ? (
          <NewRecoveryKey
            recoveryKey={recoveryKey}
            isSaving={isSaving}
            onDownload={handleDownloadRecoveryKey}
            variant="register"
          />
        ) : (
          <>
            <RegisterSteps step={step} />

            {step === 1 && <AccountDetailsForm onSubmit={onAccountSubmit} />}

            {step === 2 && (
              <DatabaseConfig onComplete={onDatabaseComplete} onBack={() => setStep(1)} />
            )}
          </>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
