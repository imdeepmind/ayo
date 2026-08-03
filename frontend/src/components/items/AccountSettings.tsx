import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { KeyRound, Trash2, AlertTriangle, type LucideIcon } from 'lucide-react';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import { accountActionSchema, type AccountActionFormData } from '@/lib/validations';

type ActionType = 'change-password' | 'delete-data' | 'delete-account' | null;

const actions: {
  id: ActionType;
  title: string;
  description: string;
  icon: LucideIcon;
  buttonLabel: string;
  confirmLabel: string;
  variant: 'warning' | 'danger';
}[] = [
  {
    id: 'change-password',
    title: 'Change Password',
    description:
      'Update your account password. You will need your current password and recovery key.',
    icon: KeyRound,
    buttonLabel: 'Change Password',
    confirmLabel: 'Update Password',
    variant: 'warning',
  },
  {
    id: 'delete-data',
    title: 'Delete All Data',
    description:
      'Permanently delete all your stored files and data. Your account will remain active.',
    icon: Trash2,
    buttonLabel: 'Delete All Data',
    confirmLabel: 'Confirm Delete Data',
    variant: 'danger',
  },
  {
    id: 'delete-account',
    title: 'Delete Account',
    description:
      'Permanently delete your account and all associated data. This action cannot be undone.',
    icon: AlertTriangle,
    buttonLabel: 'Delete Account',
    confirmLabel: 'Confirm Delete Account',
    variant: 'danger',
  },
];

export default function AccountSettings() {
  const [activeAction, setActiveAction] = useState<ActionType>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AccountActionFormData>({
    resolver: zodResolver(accountActionSchema),
    defaultValues: {
      password: '',
      recoveryKey: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const handleCancel = () => {
    setActiveAction(null);
    reset();
  };

  const onSubmit = async (data: AccountActionFormData) => {
    // UI-only — no backend integration
    console.log(`Action: ${activeAction}`, data);

    if (activeAction === 'change-password') {
      toast.success('Password changed successfully! (UI only — no backend)');
    } else if (activeAction === 'delete-data') {
      toast.success('All data deleted! (UI only — no backend)');
    } else if (activeAction === 'delete-account') {
      toast.success('Account deleted! (UI only — no backend)');
    }

    handleCancel();
  };

  const currentAction = actions.find((a) => a.id === activeAction);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Account Settings</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Manage your account security and data.
        </p>
      </div>

      <div className="space-y-4">
        {actions.map((action) => (
          <div
            key={action.id}
            className={`rounded-2xl border-2 p-6 transition-all duration-200 ${
              action.variant === 'danger'
                ? 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:border-red-900/40 dark:from-red-950/20 dark:to-rose-950/20'
                : 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-yellow-950/20'
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`rounded-xl p-2.5 ${
                  action.variant === 'danger'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                }`}
              >
                <action.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {action.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {action.description}
                </p>

                {activeAction === action.id ? (
                  <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
                    <TextInput
                      id={`${action.id}-password`}
                      label="Current Password"
                      type="password"
                      placeholder="Enter your current password"
                      error={errors.password?.message}
                      {...register('password')}
                    />
                    <TextInput
                      id={`${action.id}-recovery-key`}
                      label="Recovery Key"
                      type="text"
                      placeholder="Enter your recovery key"
                      error={errors.recoveryKey?.message}
                      {...register('recoveryKey')}
                    />

                    {activeAction === 'change-password' && (
                      <>
                        <TextInput
                          id="new-password"
                          label="New Password"
                          type="password"
                          placeholder="Enter new password"
                          error={errors.newPassword?.message}
                          {...register('newPassword')}
                        />
                        <TextInput
                          id="confirm-new-password"
                          label="Confirm New Password"
                          type="password"
                          placeholder="Confirm new password"
                          error={errors.confirmNewPassword?.message}
                          {...register('confirmNewPassword')}
                        />
                      </>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button type="submit" className="text-sm" disabled={isSubmitting}>
                        {isSubmitting ? 'Processing...' : currentAction?.confirmLabel}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-sm"
                        onClick={handleCancel}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      reset();
                      setActiveAction(action.id);
                    }}
                    className={`mt-4 inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 shadow-lg ${
                      action.variant === 'danger'
                        ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-400 hover:to-rose-400 hover:shadow-xl shadow-red-500/30'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-400 hover:to-yellow-400 hover:shadow-xl shadow-amber-500/30'
                    }`}
                  >
                    {action.buttonLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
