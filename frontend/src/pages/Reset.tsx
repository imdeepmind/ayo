import { FormEvent, useRef, useState } from 'react';
import { PageSection } from '../components/bits/Section';
import { AuthCard } from '../components/items/AuthCard';
import { TextInput } from '../components/bits/Input';
import { Button } from '../components/bits/Button';

export default function Reset() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setMessage('Please provide a recovery key file.');
      return;
    }

    setMessage('Password reset requested (demo only, no backend yet).');
  };

  return (
    <PageSection>
      <AuthCard
        title="Reset password"
        description="Provide your username, recovery key file, and a new password."
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
            id="reset-username"
            name="username"
            label="Username"
            type="text"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />

          <div className="space-y-1">
            <label
              htmlFor="recovery-file"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Recovery key file
            </label>
            <input
              id="recovery-file"
              name="recovery-file"
              type="file"
              ref={fileInputRef}
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-900 dark:file:text-slate-100 dark:hover:file:bg-slate-800"
            />
          </div>

          <TextInput
            id="reset-password"
            name="password"
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a new password"
          />

          <Button type="submit" fullWidth className="mt-2">
            Submit reset request
          </Button>
        </form>
      </AuthCard>
    </PageSection>
  );
}

