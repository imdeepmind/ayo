import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageSection from '@/components/bits/Section';
import AuthCard from '@/components/items/AuthCard';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import { useAuth } from '@/context/AuthContext';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations';

export default function Reset() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
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
      await resetPassword({
        Username: data.username,
        NewPassword: data.newPassword,
        RecoveryKey: data.recoveryKey,
      });
      toast.success('Password reset successfully! Redirecting to login...');
      navigate('/auth/login');
    } catch (err) {
      console.error(err);
      toast.error(String(err) || 'An unexpected error occurred');
    }
  };

  return (
    <PageSection>
      <AuthCard
        title="Reset password"
        description="Provide your username, recovery key, and a new password."
      >
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

          <Button type="submit" fullWidth className="mt-2" isLoading={isSubmitting}>
            Submit reset request
          </Button>
        </form>
      </AuthCard>
    </PageSection>
  );
}
