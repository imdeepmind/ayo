import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Database, Server } from 'lucide-react';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import WarningBanner from '@/components/bits/WarningBanner';

export type DatabaseType = 'sqlite' | 'postgresql';

// The database configuration chosen by the user during registration. SQLite
// needs no fields (the path is auto-generated in the OS app data directory);
// PostgreSQL requires connection details.
export type DatabaseConfigData = {
  type: DatabaseType;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
};

const postgresSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z
    .string()
    .regex(/^\d+$/, 'Port must be a number')
    .refine((v) => {
      const n = Number(v);
      return n >= 1 && n <= 65535;
    }, 'Port must be between 1 and 65535'),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type PostgresFormData = z.infer<typeof postgresSchema>;

export default function DatabaseConfig({
  onComplete,
  onBack,
}: {
  onComplete: (data: DatabaseConfigData) => void;
  onBack?: () => void;
}) {
  const [type, setType] = useState<DatabaseType>('sqlite');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PostgresFormData>({
    resolver: zodResolver(postgresSchema),
    defaultValues: {
      host: 'localhost',
      port: '5432',
      database: '',
      username: '',
      password: '',
    },
  });

  const submitPostgres = (data: PostgresFormData) => {
    onComplete({
      type: 'postgresql',
      host: data.host,
      port: Number(data.port),
      database: data.database,
      username: data.username,
      password: data.password,
    });
  };

  const submitSQLite = () => {
    onComplete({ type: 'sqlite' });
  };

  const tabClass = (id: DatabaseType) =>
    `px-5 py-3 text-sm font-semibold transition-all duration-200 border-b-2 flex items-center gap-2 ${
      type === id
        ? 'border-primary text-primary'
        : 'border-transparent text-text-subtle hover:text-text hover:border-border-strong dark:text-text-subtle dark:hover:text-text dark:hover:border-border-input'
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-text">Database Configuration</h3>
        <p className="mt-1 text-sm text-text-muted">
          Choose where your account and encrypted data will be stored.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border dark:border-border-strong">
        <button type="button" className={tabClass('sqlite')} onClick={() => setType('sqlite')}>
          <Database className="h-4 w-4" />
          SQLite
        </button>
        <button
          type="button"
          className={tabClass('postgresql')}
          onClick={() => setType('postgresql')}
        >
          <Server className="h-4 w-4" />
          PostgreSQL
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface backdrop-blur-sm p-6 dark:border-border-strong">
        {type === 'sqlite' ? (
          <WarningBanner
            variant="info"
            icon={Database}
            title="Local storage"
            description="Your data will be stored locally. The database file will be created automatically in the app data directory. No setup required."
          />
        ) : (
          <form onSubmit={handleSubmit(submitPostgres)} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextInput
                id="db-host"
                label="Host"
                type="text"
                placeholder="localhost"
                error={errors.host?.message}
                {...register('host')}
              />
              <TextInput
                id="db-port"
                label="Port"
                type="number"
                placeholder="5432"
                error={errors.port?.message}
                {...register('port')}
              />
            </div>
            <TextInput
              id="db-database"
              label="Database"
              type="text"
              placeholder="Database name"
              error={errors.database?.message}
              {...register('database')}
            />
            <TextInput
              id="db-username"
              label="Username"
              type="text"
              autoComplete="off"
              placeholder="Database user"
              error={errors.username?.message}
              {...register('username')}
            />
            <TextInput
              id="db-password"
              label="Password"
              type="password"
              placeholder="Database password"
              error={errors.password?.message}
              {...register('password')}
            />

            <WarningBanner
              className="p-4"
              title="Connection verification"
              description="Ayo will verify the database is reachable before creating your account. Your connection details are encrypted and stored securely on this device."
            />

            <div className="flex gap-3 pt-2">
              {onBack && (
                <Button type="button" variant="ghost" onClick={onBack}>
                  Back
                </Button>
              )}
              <Button type="submit" fullWidth>
                Continue
              </Button>
            </div>
          </form>
        )}
      </div>

      {type === 'sqlite' && (
        <div className="flex gap-3">
          {onBack && (
            <Button type="button" variant="ghost" onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="button" fullWidth onClick={submitSQLite}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
