import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageSection from '@/components/bits/Section';
import AuthCard from '@/components/items/AuthCard';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';

import { Login as LoginService } from "../../wailsjs/go/auth/Service";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await LoginService({ Username: username, Password: password });

      if (result) {
        navigate('/');
      } else {
        setError('Invalid username or password. Try admin / password.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageSection>
      <AuthCard
        title="Login"
        description={
          <>
            Please provide your username and password to login to your ayo drive.
          </>
        }
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            id="username"
            name="username"
            label="Username"
            type="text"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />

          <TextInput
            id="password"
            name="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth className="mt-2" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </AuthCard>
    </PageSection>
  );
}

