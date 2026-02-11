import { FormEvent, useState } from 'react';
import { PageSection } from '../components/bits/Section';
import { AuthCard } from '../components/items/AuthCard';
import { TextInput } from '../components/bits/Input';
import { Button } from '../components/bits/Button';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setMessage('Account created (demo only, no backend yet).');
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

          <Button type="submit" fullWidth className="mt-2">
            Create account
          </Button>
        </form>
      </AuthCard>
    </PageSection>
  );
}

