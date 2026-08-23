import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

import { toErrorMessage } from '@/lib/errors';
import { registerSchema, type RegisterFormData } from '@/lib/validations';

import Button from '@/components/bits/Button';
import TextInput from '@/components/bits/Input';
import PageSection from '@/components/bits/Section';
import AuthCard from '@/components/items/AuthCard';
import DatabaseConfig, { type DatabaseConfigData } from '@/components/items/DatabaseConfig';

import { auth } from '../../wailsjs/go/models';
import { SaveRecoveryKey } from '../../wailsjs/go/recovery/Service';

export default function Register() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [accountData, setAccountData] = useState<RegisterFormData | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

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
      const result = await registerUser(
        new auth.RegisterInput({
          Username: accountData.username,
          Password: accountData.password,
          DBConfig: {
            Type: dbData.type,
            Path: '',
            Host: dbData.host || '',
            Port: dbData.port || 0,
            Database: dbData.database || '',
            Username: dbData.username || '',
            Password: dbData.password || '',
          },
        })
      );
      if (result) {
        setRecoveryKey(result.RecoveryKey);
        toast.success('Account created successfully! Please download your recovery key.');
      } else {
        toast.error('Failed to create account. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      toast.error(toErrorMessage(err, 'An unexpected error occurred. Please try again.'));
    }
  };

  const handleDownloadRecoveryKey = async () => {
    if (!recoveryKey || !accountData) return;

    setIsSaving(true);
    try {
      const username = accountData.username;
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

  const stepIndicator = (
    <div className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold">
      <span className={step === 1 ? 'text-primary' : 'text-text-faint'}>1. Account Details</span>
      <span className="text-border-strong">—</span>
      <span className={step === 2 ? 'text-primary' : 'text-text-faint'}>
        2. Database Configuration
      </span>
    </div>
  );

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
          !recoveryKey &&
          step === 1 && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-text-muted">
              <span>Already have an account?</span>
              <Link
                to="/auth/login"
                className="font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                Sign in →
              </Link>
            </div>
          )
        }
      >
        {recoveryKey ? (
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-xl border border-primary/20 dark:border-primary/40 bg-gradient-to-br from-primary/5 to-primary/5 dark:from-primary/10 dark:to-primary/10 p-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-16 -mt-16" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-5 h-5 text-primary"
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
                  <p className="text-sm font-semibold text-primary">Your Recovery Key</p>
                </div>
                <div className="bg-background rounded-lg p-4 backdrop-blur-sm border border-primary/20 dark:border-primary/40">
                  <p className="font-mono text-sm break-all text-text leading-relaxed">
                    {recoveryKey}
                  </p>
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">
                    Critical: Store this key securely
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200/70 leading-relaxed">
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
              {isSaving ? 'Saving...' : 'Download Recovery Key'}
            </Button>
          </div>
        ) : (
          <>
            {stepIndicator}

            {step === 1 && (
              <form onSubmit={handleSubmit(onAccountSubmit)} className="space-y-5">
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
                    {isSubmitting ? 'Creating your account...' : 'Continue'}
                  </Button>
                </div>
              </form>
            )}

            {step === 2 && (
              <DatabaseConfig onComplete={onDatabaseComplete} onBack={() => setStep(1)} />
            )}
          </>
        )}
      </AuthCard>
    </PageSection>
  );
}
