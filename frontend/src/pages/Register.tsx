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
import { registerSchema, type RegisterFormData } from '@/lib/validations';

export default function Register() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const result = await registerUser({ Username: data.username, Password: data.password });
      if (result) {
        setRecoveryKey(result.RecoveryKey);
        toast.success('Account created successfully! Please download your recovery key.');
      } else {
        toast.error('Failed to create account. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      toast.error(String(err) || 'An unexpected error occurred. Please try again.');
    }
  };

  const handleDownloadRecoveryKey = async () => {
    if (!recoveryKey) return;

    setIsSaving(true);
    try {
      const username = getValues('username');
      await SaveRecoveryKey(username, recoveryKey);
      toast.success('Recovery key saved successfully! Redirecting to login...');
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
        title={recoveryKey ? 'Save your recovery key' : 'Create your account'}
        description={
          recoveryKey
            ? 'This key is essential for account recovery. Store it in a safe place.'
            : 'Join ayo and start storing your files securely with end-to-end encryption.'
        }
        footer={
          !recoveryKey && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <span>Already have an account?</span>
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
        {recoveryKey ? (
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-xl border-2 border-sky-200 dark:border-sky-800 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 p-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/10 rounded-full blur-2xl -mr-16 -mt-16" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-5 h-5 text-sky-600 dark:text-sky-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                    Your Recovery Key
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/50 rounded-lg p-4 backdrop-blur-sm border border-sky-200/50 dark:border-sky-800/50">
                  <p className="font-mono text-sm break-all text-slate-900 dark:text-slate-100 leading-relaxed">
                    {recoveryKey}
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    Critical: Store this key securely
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                    You&apos;ll need this recovery key to reset your password. Without it, you
                    won&apos;t be able to recover your account or access your encrypted files.
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
              {isSaving ? 'Saving...' : '💾 Download Recovery Key'}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <TextInput
              id="reg-username"
              label="Username"
              type="text"
              autoComplete="off"
              placeholder="Choose a username"
              error={errors.username?.message}
              {...register('username')}
            />

            <TextInput
              id="reg-password"
              label="Password"
              type="password"
              placeholder="Choose a strong password"
              error={errors.password?.message}
              {...register('password')}
            />

            <TextInput
              id="reg-confirm-password"
              label="Confirm Password"
              type="password"
              placeholder="Re-enter your password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <div className="pt-2">
              <Button type="submit" fullWidth disabled={isSubmitting}>
                {isSubmitting ? 'Creating your account...' : 'Create account'}
              </Button>
            </div>
          </form>
        )}
      </AuthCard>
    </PageSection>
  );
}
