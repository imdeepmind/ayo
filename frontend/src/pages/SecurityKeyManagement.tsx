import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import Toggle from '@/components/bits/Toggle';
import ConfirmDialog from '@/components/bits/ConfirmDialog';
import { toErrorMessage } from '@/lib/errors';
import { GetMasterKeyStorage, SetMasterKeyStorage } from '../../wailsjs/go/auth/Service';

type MasterKeyStorage = 'database' | 'keyring';

export default function SecurityKeyManagement() {
  const [storage, setStorage] = useState<MasterKeyStorage | null>(null);
  const [pendingStorage, setPendingStorage] = useState<MasterKeyStorage | null>(null);

  const loadStorage = async () => {
    try {
      const current = await GetMasterKeyStorage();
      setStorage(current === 'keyring' ? 'keyring' : 'database');
    } catch (error) {
      console.error('Failed to load master key storage:', error);
    }
  };

  useEffect(() => {
    loadStorage();
  }, []);

  const handleToggle = (checked: boolean) => {
    setPendingStorage(checked ? 'keyring' : 'database');
  };

  const handleConfirm = async () => {
    const target = pendingStorage;
    setPendingStorage(null);
    if (!target || target === storage) return;

    try {
      const result = await SetMasterKeyStorage(target);
      setStorage(result === 'keyring' ? 'keyring' : 'database');
      toast.success(
        result === 'keyring'
          ? 'Master key moved to the OS keyring.'
          : 'Master key moved back to the database.'
      );
    } catch (error) {
      console.error('Failed to change master key storage:', error);
      toast.error(toErrorMessage(error, 'Failed to move the master key.'));
    }
  };

  return (
    <div className="w-full relative space-y-6">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-bold text-text">Key Management</h1>
      </div>

      <div className="rounded-2xl border-2 border-border bg-background backdrop-blur-sm p-6 shadow-lg dark:border-border-strong">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-primary/10 p-2.5 dark:bg-primary/20">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-text-faint dark:text-text-subtle">
              Master Key Storage
            </p>
            <p className="text-lg font-bold text-text">
              {storage === null ? 'Checking...' : storage === 'keyring' ? 'OS keyring' : 'Database'}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Toggle
            id="master-key-keyring"
            label="Store master key in OS keyring"
            description="Keeps both the password and recovery copies (salt, nonce and ciphertext) in the system keychain. The database columns then hold random data."
            checked={storage === 'keyring'}
            disabled={storage === null}
            onChange={(e) => handleToggle(e.target.checked)}
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={pendingStorage !== null}
        title="Move encrypted master key?"
        message={
          pendingStorage === 'keyring'
            ? 'The password and recovery copies of your master key (salts, nonces and ciphertext) will be moved to the OS keyring, and your database will only keep random data. This makes the key material recoverable only through the system credential store.'
            : 'The password and recovery copies of your master key (salts, nonces and ciphertext) will be moved from the OS keyring back into your database, and the keyring entry will be deleted.'
        }
        confirmLabel="Move Key"
        destructive={false}
        onConfirm={handleConfirm}
        onCancel={() => setPendingStorage(null)}
      />
    </div>
  );
}
