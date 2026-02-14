import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageSection from '@/components/bits/Section';
import AuthCard from '@/components/items/AuthCard';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import { useAuth } from '@/context/AuthContext';
import { SaveRecoveryKey } from '../../wailsjs/go/fileops/Service';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const user = await register({ Username: username, Password: password });
      if (user) {
        setRecoveryKey(user.RecoveryKey);
        setMessage('Account created successfully! Please download your recovery key.');
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

  const handleDownloadRecoveryKey = async () => {
    if (!recoveryKey) return;

    setIsSaving(true);
    try {
      await SaveRecoveryKey(username, recoveryKey);
      // After saving, redirect to login
      setTimeout(() => {
        navigate('/auth/login');
      }, 500);
    } catch (err) {
      console.error('Failed to save recovery key:', err);
      setError('Failed to save recovery key. Please try again.');
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
        footer={
          message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
              {message}
            </p>
          )
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
                ⚠️ <strong>Important:</strong> Store this recovery key in a safe place. You will need it to restore your account if you forget your password.
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
        )}
      </AuthCard>
    </PageSection>
  );
}
