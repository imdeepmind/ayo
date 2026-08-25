import { zodResolver } from '@hookform/resolvers/zod';
import { Database, Server } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import Button from '@/components/bits/Button';
import TextInput from '@/components/bits/Input';
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

type PostgresFormData = z.infer<ReturnType<typeof postgresSchema>>;

function postgresSchema(t: (key: string) => string) {
  return z.object({
    host: z.string().min(1, t('database.hostRequired')),
    port: z
      .string()
      .regex(/^\d+$/, t('database.portMustBeNumber'))
      .refine((v) => {
        const n = Number(v);
        return n >= 1 && n <= 65535;
      }, t('database.portRange')),
    database: z.string().min(1, t('database.databaseRequired')),
    username: z.string().min(1, t('database.usernameRequired')),
    password: z.string().min(1, t('database.passwordRequired')),
  });
}

export default function DatabaseConfig({
  onComplete,
  onBack,
}: {
  onComplete: (data: DatabaseConfigData) => void;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<DatabaseType>('sqlite');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PostgresFormData>({
    resolver: zodResolver(postgresSchema(t)),
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
      {/* Tabs */}
      <div className="flex border-b border-border dark:border-border-strong">
        <button type="button" className={tabClass('sqlite')} onClick={() => setType('sqlite')}>
          <Database className="h-4 w-4" />
          {t('database.sqlite')}
        </button>
        <button
          type="button"
          className={tabClass('postgresql')}
          onClick={() => setType('postgresql')}
        >
          <Server className="h-4 w-4" />
          {t('database.postgresql')}
        </button>
      </div>

      {type === 'sqlite' ? (
        <WarningBanner
          variant="info"
          icon={Database}
          title={t('database.localStorage')}
          description={t('database.localStorageDescription')}
        />
      ) : (
        <form onSubmit={handleSubmit(submitPostgres)} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput
              id="db-host"
              label={t('database.host')}
              type="text"
              placeholder={t('database.hostPlaceholder')}
              error={errors.host?.message}
              {...register('host')}
            />
            <TextInput
              id="db-port"
              label={t('database.port')}
              type="number"
              placeholder={t('database.portPlaceholder')}
              error={errors.port?.message}
              {...register('port')}
            />
          </div>
          <TextInput
            id="db-database"
            label={t('database.database')}
            type="text"
            placeholder={t('database.databasePlaceholder')}
            error={errors.database?.message}
            {...register('database')}
          />
          <TextInput
            id="db-username"
            label={t('database.username')}
            type="text"
            autoComplete="off"
            placeholder={t('database.usernamePlaceholder')}
            error={errors.username?.message}
            {...register('username')}
          />
          <TextInput
            id="db-password"
            label={t('database.password')}
            type="password"
            placeholder={t('database.passwordPlaceholder')}
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex gap-3 pt-2">
            {onBack && (
              <Button type="button" variant="ghost" onClick={onBack}>
                {t('database.back')}
              </Button>
            )}
            <Button type="submit" fullWidth>
              {t('database.continue')}
            </Button>
          </div>
        </form>
      )}

      {type === 'sqlite' && (
        <div className="flex gap-3">
          {onBack && (
            <Button type="button" variant="ghost" onClick={onBack}>
              {t('database.back')}
            </Button>
          )}
          <Button type="button" fullWidth onClick={submitSQLite}>
            {t('database.continue')}
          </Button>
        </div>
      )}
    </div>
  );
}
