import { X } from 'lucide-react';
import Button from '@/components/bits/Button';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// ConfirmDialog is the in-app replacement for window.confirm, which the Wails
// webview does not support. It follows the same overlay pattern as the other
// modals in the app.
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            onClick={onCancel}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>

        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? 'bg-red-500 text-white shadow-md shadow-red-500/40 hover:bg-red-600 active:bg-red-700 focus:ring-red-400'
                : undefined
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
