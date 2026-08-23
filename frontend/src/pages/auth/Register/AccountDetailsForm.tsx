import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { registerSchema, type RegisterFormData } from '@/lib/validations';

import Button from '@/components/bits/Button';
import TextInput from '@/components/bits/Input';

type AccountDetailsFormProps = {
  onSubmit: (data: RegisterFormData) => void;
};

export default function AccountDetailsForm({ onSubmit }: AccountDetailsFormProps) {
  const { t } = useTranslation();

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <TextInput
        id="reg-username"
        label={t('auth.username')}
        type="text"
        autoComplete="off"
        placeholder={t('auth.chooseUsername')}
        error={errors.username?.message}
        {...register('username')}
      />

      <TextInput
        id="reg-password"
        label={t('auth.password')}
        type="password"
        placeholder={t('auth.choosePassword')}
        error={errors.password?.message}
        {...register('password')}
      />

      <TextInput
        id="reg-confirm-password"
        label={t('auth.confirmPassword')}
        type="password"
        placeholder={t('auth.confirmRegisterPasswordPlaceholder')}
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <div className="pt-2">
        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? t('auth.creatingAccount') : t('auth.continue')}
        </Button>
      </div>
    </form>
  );
}
