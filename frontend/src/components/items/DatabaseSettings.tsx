import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Database, Server } from 'lucide-react';
import { GetDatabaseInfo } from '../../../wailsjs/go/settings/Service';
import { settings } from '../../../wailsjs/go/models';

// Read-only display of the signed-in user's database configuration. The choice
// of database is permanent and cannot be edited here; the password is never
// exposed (the backend returns sanitized information only).
export default function DatabaseSettings() {
  const [info, setInfo] = useState<settings.DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    GetDatabaseInfo()
      .then((dbInfo) => setInfo(dbInfo))
      .catch((err) => {
        console.error('Failed to load database info:', err);
        toast.error('Failed to load database information');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full relative space-y-6">
        <div className="flex items-center justify-between py-2">
          <h1 className="text-2xl font-bold text-text">Database Settings</h1>
        </div>
        <p className="text-sm text-text-subtle">Loading database information...</p>
      </div>
    );
  }

  const isPostgres = info?.Type === 'postgresql';

  return (
    <div className="w-full relative space-y-6">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-bold text-text">Database Settings</h1>
      </div>

      <div className="rounded-2xl border-2 border-border bg-background backdrop-blur-sm p-6 shadow-lg dark:border-border-strong">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-primary/10 p-3 dark:bg-primary/20">
            {isPostgres ? (
              <Server className="h-6 w-6 text-primary" />
            ) : (
              <Database className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-text-faint dark:text-text-subtle">
              Database Type
            </p>
            <p className="text-lg font-bold text-text">{isPostgres ? 'PostgreSQL' : 'SQLite'}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {isPostgres ? (
            <>
              <Field label="Host" value={info?.Host || '-'} />
              <Field label="Port" value={info?.Port ? String(info.Port) : '-'} />
              <Field label="Database" value={info?.Database || '-'} />
              <Field label="Username" value={info?.Username || '-'} />
            </>
          ) : (
            <Field label="Database File" value={info?.Path || '-'} mono />
          )}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-6 dark:border-amber-700/60 dark:from-amber-950/20 dark:to-yellow-950/20">
        <div className="flex gap-4">
          <div className="rounded-xl bg-amber-100 p-2.5 dark:bg-amber-900/30">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-amber-900 dark:text-amber-100">
              {isPostgres
                ? 'Remote metadata is stored on your database server'
                : 'Data loss risk on this device'}
            </p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
              {isPostgres
                ? 'Your encrypted data is stored in the configured PostgreSQL server. The database itself is not encrypted by ayo, so the server operator could see storage and access metadata.'
                : 'Your data is stored in a local SQLite database file on this device. If the file is lost or the device fails, your data may be unrecoverable. Back up your recovery key.'}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-faint dark:text-text-subtle">
        The database choice is permanent and cannot be changed.
      </p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-text-faint dark:text-text-subtle">
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold text-text break-all ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}
