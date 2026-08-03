import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageSection from '@/components/bits/Section';
import AuthCard from '@/components/items/AuthCard';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import { useAuth } from '@/context/AuthContext';
import { SaveRecoveryKey } from '../../wailsjs/go/recovery/Service';
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
      const result = await resetPassword({
        Username: data.username,
        NewPassword: data.newPassword,
        RecoveryKey: data.recoveryKey,
      });
      if (result) {
        setNewRecoveryKey(result.RecoveryKey);
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
      navigate('/auth/login');
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
        title={newRecoveryKey ? 'Save your new recovery key' : 'Reset your password'}
        description={
          newRecoveryKey
            ? 'Your password has been reset. Save your new recovery key securely.'
            : 'Enter your username, recovery key, and choose a new password.'
        }
        footer={
          !newRecoveryKey && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <span>Remember your password?</span>
              <Link
                to="/auth/login"
                className="font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
              >
                Sign in →
              </Link>
            </div>
          )
        }
      >
        {newRecoveryKey ? (
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-5">
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
                    Your New Recovery Key
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/50 rounded-lg p-4 backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-800/50">
                  <p className="font-mono text-sm break-all text-slate-900 dark:text-slate-100 leading-relaxed">
                    {newRecoveryKey}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 p-5">
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
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    Important: Your old recovery key is invalid
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                    Store this new recovery key in a safe place. Your previous recovery key will no
                    longer work for password resets.
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              fullWidth
              onClick={handleDownloadRecoveryKey}
              className="mt-2"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : '💾 Download New Recovery Key'}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
              label="Recovery Key"
              type="password"
              placeholder="Enter your recovery key"
              error={errors.recoveryKey?.message}
              {...register('recoveryKey')}
            />

            <div className="pt-1">
              <TextInput
                id="reset-password"
                label="New Password"
                type="password"
                placeholder="Choose a new password"
                error={errors.newPassword?.message}
                {...register('newPassword')}
              />
            </div>

            <TextInput
              id="reset-confirm-password"
              label="Confirm Password"
              type="password"
              placeholder="Re-enter your new password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <div className="pt-2">
              <Button type="submit" fullWidth isLoading={isSubmitting}>
                Reset password
              </Button>
            </div>
          </form>
        )}
      </AuthCard>
    </PageSection>
  );
}
