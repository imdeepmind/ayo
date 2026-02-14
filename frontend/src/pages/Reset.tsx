import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageSection from '@/components/bits/Section';
import AuthCard from '@/components/items/AuthCard';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import { useAuth } from '@/context/AuthContext';

export default function Reset() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await resetPassword({
        Username: username,
        NewPassword: password,
        RecoveryKey: recoveryKey,
      });
      toast.success('Password reset successfully! Redirecting to login...');
      navigate('/auth/login');
    } catch (err) {
      console.error(err);
      toast.error(String(err) || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageSection>
      <AuthCard
        title="Reset password"
        description="Provide your username, recovery key, and a new password."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            id="reset-username"
            name="username"
            label="Username"
            type="text"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />

          <TextInput
            id="recovery-key"
            name="recovery-key"
            label="Recovery key"
            type="password"
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            placeholder="Enter a recovery key"
          />

          <TextInput
            id="reset-password"
            name="password"
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a new password"
          />

          <Button type="submit" fullWidth className="mt-2" isLoading={isSubmitting}>
            Submit reset request
          </Button>
        </form>
      </AuthCard>
    </PageSection>
  );
}
