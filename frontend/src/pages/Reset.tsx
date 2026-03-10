import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageSection from '@/components/bits/Section';
import AuthCard from '@/components/items/AuthCard';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import { useAuth } from '@/context/AuthContext';
import { SaveRecoveryKey } from '../../wailsjs/go/fileops/Service';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations';

export default function Reset() {
  const { resetPassword } = useAuth();
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
      const user = await resetPassword({
        Username: data.username,
        NewPassword: data.newPassword,
        RecoveryKey: data.recoveryKey,
      });
      if (user) {
        setNewRecoveryKey(user.RecoveryKey);
        toast.success('Password reset successfully! Please download your new recovery key.');
      } else {
        toast.error('Failed to reset password. Please try again.');
      }
    } catch (err) {
      console.error(err);
      toast.error(String(err) || 'An unexpected error occurred');
    }
  };

  const handleDownloadRecoveryKey = async () => {
    if (!newRecoveryKey) return;

    setIsSaving(true);
    try {
      const username = getValues('username');
      await SaveRecoveryKey(username, newRecoveryKey);
      toast.success('New recovery key saved successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/auth/login');
      }, 500);
    } catch (err) {
      console.error('Failed to save recovery key:', err);
      toast.error('Failed to save recovery key. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageSection>
      <AuthCard
        title="Reset password"
        description={
          newRecoveryKey
            ? 'Save your new recovery key securely. You will need it if you forget your password again.'
            : 'Provide your username, recovery key, and a new password.'
        }
      >
        {newRecoveryKey ? (
          <div className="space-y-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-semibold">
                Your New Recovery Key:
              </p>
              <p className="font-mono text-sm break-all text-gray-900 dark:text-gray-100">
                {newRecoveryKey}
              </p>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-300 dark:border-amber-700">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ <strong>Important:</strong> Store this new recovery key in a safe place. Your old
                recovery key is no longer valid.
              </p>
            </div>

            <Button
              type="button"
              fullWidth
              onClick={handleDownloadRecoveryKey}
              className="mt-2"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Download New Recovery Key'}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextInput
              id="reset-username"
              label="Username"
              type="text"
              autoComplete="off"
              placeholder="Enter your username"
              error={errors.username?.message}
              {...register('username')}
            />

            <TextInput
              id="recovery-key"
              label="Recovery key"
              type="password"
              placeholder="Enter a recovery key"
              error={errors.recoveryKey?.message}
              {...register('recoveryKey')}
            />

            <TextInput
              id="reset-password"
              label="New password"
              type="password"
              placeholder="Enter a new password"
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />

            <TextInput
              id="reset-confirm-password"
              label="Confirm password"
              type="password"
              placeholder="Confirm your new password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button type="submit" fullWidth className="mt-2" isLoading={isSubmitting}>
              Submit reset request
            </Button>
          </form>
        )}
      </AuthCard>
    </PageSection>
  );
}
