import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

import { toErrorMessage } from '@/lib/errors';
import { loginSchema, type LoginFormData } from '@/lib/validations';

import Button from '@/components/bits/Button';
import TextInput from '@/components/bits/Input';
import AuthCard from '@/components/items/AuthCard';
import AuthLayout from '@/components/items/AuthLayout';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await login({ Username: data.username, Password: data.password });

      if (result) {
        toast.success(t('auth.loginSuccessful'));
        navigate('/');
      } else {
        toast.error(t('auth.invalidCredentials'));
      }
    } catch (err) {
      console.error('Login error:', err);
      const message = String(err);
      if (message.toLowerCase().includes('database')) {
        toast.error(t('auth.databaseUnreachable'));
      } else {
        toast.error(toErrorMessage(err, t('common.unexpectedError')));
      }
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title={t('auth.welcomeBack')}
        description={<>{t('auth.signInDescription')}</>}
        footer={
          <div className="flex flex-col items-center justify-between gap-3 text-sm text-text-muted sm:flex-row">
            <div className="flex items-center gap-1.5">
              <span>{t('auth.newToAyo')}</span>
              <Link
                to="/auth/register"
                className="font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                {t('auth.createAccount')}
              </Link>
            </div>
            <Link
              to="/auth/reset"
              className="font-medium text-text-subtle hover:text-primary dark:hover:text-primary transition-colors"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <TextInput
            id="username"
            label={t('auth.username')}
            type="text"
            autoComplete="off"
            placeholder={t('auth.usernamePlaceholder')}
            error={errors.username?.message}
            {...register('username')}
          />

          <TextInput
            id="password"
            label={t('auth.password')}
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" fullWidth className="mt-6" disabled={isSubmitting}>
            {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
