import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageSection from '@/components/bits/Section';
import AuthCard from '@/components/items/AuthCard';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import { useAuth } from '@/context/AuthContext';
import { loginSchema, type LoginFormData } from '@/lib/validations';

export default function Login() {
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
        toast.success('Login successful!');
        navigate('/');
      } else {
        toast.error('Invalid username or password.');
      }
    } catch (err) {
      console.error('Login error:', err);
      const message = String(err);
      if (message.toLowerCase().includes('database')) {
        toast.error(
          'Unable to connect to your database. Please check that the database is accessible and try again.'
        );
      } else {
        toast.error(message || 'An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <PageSection>
      <AuthCard
        title="Welcome back"
        description={<>Sign in to access your secure, encrypted ayo drive</>}
        footer={
          <div className="flex flex-col items-center justify-between gap-3 text-sm text-text-muted sm:flex-row">
            <div className="flex items-center gap-1.5">
              <span>New to ayo?</span>
              <Link
                to="/auth/register"
                className="font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                Create an account →
              </Link>
            </div>
            <Link
              to="/auth/reset"
              className="font-medium text-text-subtle hover:text-primary dark:hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <TextInput
            id="username"
            label="Username"
            type="text"
            autoComplete="off"
            placeholder="Enter your username"
            error={errors.username?.message}
            {...register('username')}
          />

          <TextInput
            id="password"
            label="Password"
            type="password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" fullWidth className="mt-6" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </AuthCard>
    </PageSection>
  );
}
