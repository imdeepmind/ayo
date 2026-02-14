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
      toast.error(String(err) || 'An unexpected error occurred. Please try again.');
    }
  };

  return (
    <PageSection>
      <AuthCard
        title="Login"
        description={<>Please provide your username and password to login to your ayo drive.</>}
        footer={
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 sm:flex-row">
            <div className="flex gap-2">
              <span>New here?</span>
              <Link
                to="/auth/register"
                className="font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
              >
                Create an account
              </Link>
            </div>
            <Link
              to="/auth/reset"
              className="font-medium text-slate-600 underline underline-offset-4 hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-300"
            >
              Forgot password?
            </Link>
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <Button type="submit" fullWidth className="mt-2" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </AuthCard>
    </PageSection>
  );
}
