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
      const user = await registerUser({ Username: data.username, Password: data.password });
      if (user) {
        setRecoveryKey(user.RecoveryKey);
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
        title="Register"
        description={
          recoveryKey
            ? 'Save your recovery key securely. You will need it to restore your account.'
            : 'Create a simple demo account with a username and password.'
        }
      >
        {recoveryKey ? (
          <div className="space-y-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-semibold">
                Your Recovery Key:
              </p>
              <p className="font-mono text-sm break-all text-gray-900 dark:text-gray-100">
                {recoveryKey}
              </p>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-300 dark:border-amber-700">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ <strong>Important:</strong> Store this recovery key in a safe place. You will
                need it to restore your account if you forget your password.
              </p>
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

            <Button type="submit" fullWidth className="mt-2" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        )}
      </AuthCard>
    </PageSection>
  );
}
