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
            description: 'Update your account password. You will need your current password and recovery key.',
            icon: KeyRound,
            buttonLabel: 'Change Password',
            confirmLabel: 'Update Password',
            variant: 'warning',
        },
        {
            id: 'delete-data',
            title: 'Delete All Data',
            description: 'Permanently delete all your stored files and data. Your account will remain active.',
            icon: Trash2,
            buttonLabel: 'Delete All Data',
            confirmLabel: 'Confirm Delete Data',
            variant: 'danger',
        },
        {
            id: 'delete-account',
            title: 'Delete Account',
            description: 'Permanently delete your account and all associated data. This action cannot be undone.',
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
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Account Settings
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Manage your account security and data.
                </p>
            </div>

            <div className="space-y-3">
                {actions.map((action) => (
                    <div
                        key={action.id}
                        className={`rounded-xl border p-4 transition ${action.variant === 'danger'
                            ? 'border-red-200 bg-red-50/30 dark:border-red-900/40 dark:bg-red-900/10'
                            : 'border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-900/10'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <action.icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {action.title}
                                </h3>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                    {action.description}
                                </p>

                                {activeAction === action.id ? (
                                    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
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

                                        <div className="flex gap-2 pt-1">
                                            <Button type="submit" className="text-xs px-3 py-1.5" disabled={isSubmitting}>
                                                {isSubmitting ? 'Processing...' : currentAction?.confirmLabel}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="text-xs px-3 py-1.5"
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
                                        className={`mt-3 inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition ${action.variant === 'danger'
                                            ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
                                            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
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
