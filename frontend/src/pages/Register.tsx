import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageSection from '@/components/bits/Section';
import AuthCard from '@/components/items/AuthCard';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import { useAuth } from '@/context/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const success = await register({ Username: username, Password: password });
      if (success) {
        setMessage('Account created successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/auth/login');
        }, 1500);
      } else {
        setError('Failed to create account. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(String(err) || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageSection>
      <AuthCard
        title="Register"
        description="Create a simple demo account with a username and password."
        footer={
          message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
              {message}
            </p>
          )
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            id="reg-username"
            name="username"
            label="Username"
            type="text"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
          />

          <TextInput
            id="reg-password"
            name="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose a strong password"
          />

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth className="mt-2" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </AuthCard>
    </PageSection>
  );
}
