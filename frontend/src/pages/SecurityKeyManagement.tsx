import toast from 'react-hot-toast';
import { KeyRound, ShieldCheck, ShieldAlert, Lock } from 'lucide-react';
import Button from '@/components/bits/Button';
import { useAuth } from '@/context/AuthContext';

export default function SecurityKeyManagement() {
  const { session } = useAuth();

  const handleDownloadRecoveryKey = () => {
    toast('Your recovery key is only shown once, right after registration or password reset.');
  };

  const keys = [
    {
      icon: <Lock className="h-5 w-5" />,
      title: 'Master Key',
      description:
        'Derived from your password and used to unlock everything. Never stored on disk.',
      status: 'Derived in-memory',
      ok: true,
    },
    {
      icon: <KeyRound className="h-5 w-5" />,
      title: 'Recovery Key',
      description:
        'Backs up your database credentials. Shown once at registration and after a password reset.',
      status: 'Shown once',
      ok: false,
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: 'Key Encryption Key (KEK)',
      description: 'Encrypts your stored database credentials with password and recovery keys.',
      status: 'Active',
      ok: true,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text">Key Management</h2>
        <p className="mt-2 text-sm text-text-muted">
          Review how {session?.Username || 'your account'}&apos;s encryption keys are protected.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((k) => (
          <div
            key={k.title}
            className="rounded-2xl border-2 border-border bg-background backdrop-blur-sm p-6 shadow-lg dark:border-border-strong"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 dark:bg-primary/20">
                <span className="text-primary">{k.icon}</span>
              </div>
              <h3 className="text-sm font-bold text-text">{k.title}</h3>
            </div>
            <p className="mt-3 text-sm text-text-muted leading-relaxed">{k.description}</p>
            <p
              className={`mt-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${
                k.ok
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}
            >
              {k.ok ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" />
              )}
              {k.status}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border-2 border-border bg-background backdrop-blur-sm p-6 shadow-lg dark:border-border-strong">
        <h3 className="text-base font-bold text-text">Recovery</h3>
        <p className="mt-1 text-sm text-text-muted leading-relaxed">
          Your recovery key is essential for resetting your password. It is only ever shown once, so
          if you lost it, resetting your password is the only way to obtain a new one.
        </p>
        <div className="mt-4">
          <Button type="button" variant="ghost" onClick={handleDownloadRecoveryKey}>
            Download Recovery Key
          </Button>
        </div>
      </div>
    </div>
  );
}
