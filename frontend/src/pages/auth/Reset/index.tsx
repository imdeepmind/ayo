import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

import { toErrorMessage } from '@/lib/errors';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations';

import Button from '@/components/bits/Button';
import TextInput from '@/components/bits/Input';
import AuthCard from '@/components/items/AuthCard';
import AuthLayout from '@/components/items/AuthLayout';
import NewRecoveryKey from '@/components/items/NewRecoveryKey';

export default function Reset() {
  const { resetPassword, saveRecoveryKey } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      username: '',
      recoveryKey: '',
      newPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      const result = await resetPassword({
        Username: data.username,
        NewPassword: data.newPassword,
        RecoveryKey: data.recoveryKey,
      });
      if (result) {
        setNewRecoveryKey(result.RecoveryKey);
        toast.success(t('auth.passwordResetSuccess'));
      } else {
        toast.error(t('auth.passwordResetFailed'));
      }
    } catch (err) {
      console.error(err);
      toast.error(toErrorMessage(err, t('auth.unexpectedError')));
    }
  };

  const handleDownloadRecoveryKey = async () => {
    if (!newRecoveryKey) return;

    setIsSaving(true);
    try {
      const username = getValues('username');
      await saveRecoveryKey(username, newRecoveryKey);
      // The key is only ever shown once; drop the reference as soon as the
      // save completes so the JS heap copy is released promptly.
      setNewRecoveryKey(null);
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
        title={newRecoveryKey ? t('auth.saveRecoveryKeyTitle') : t('auth.resetPasswordTitle')}
        description={
          newRecoveryKey ? t('auth.saveRecoveryKeyDescription') : t('auth.resetPasswordDescription')
        }
        footer={
          !newRecoveryKey && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-text-muted">
              <span>{t('auth.rememberPassword')}</span>
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
        {newRecoveryKey ? (
          <NewRecoveryKey
            recoveryKey={newRecoveryKey}
            isSaving={isSaving}
            onDownload={handleDownloadRecoveryKey}
          />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <TextInput
              id="reset-username"
              label={t('auth.username')}
              type="text"
              autoComplete="off"
              placeholder={t('auth.usernamePlaceholder')}
              error={errors.username?.message}
              {...register('username')}
            />

            <TextInput
              id="recovery-key"
              label={t('auth.recoveryKey')}
              type="password"
              placeholder={t('auth.recoveryKeyPlaceholder')}
              error={errors.recoveryKey?.message}
              {...register('recoveryKey')}
            />

            <div className="pt-1">
              <TextInput
                id="reset-password"
                label={t('auth.newPassword')}
                type="password"
                placeholder={t('auth.newPasswordPlaceholder')}
                error={errors.newPassword?.message}
                {...register('newPassword')}
              />
            </div>

            <TextInput
              id="reset-confirm-password"
              label={t('auth.confirmPassword')}
              type="password"
              placeholder={t('auth.confirmPasswordPlaceholder')}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <div className="pt-2">
              <Button type="submit" fullWidth isLoading={isSubmitting}>
                {t('auth.resetPassword')}
              </Button>
            </div>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
