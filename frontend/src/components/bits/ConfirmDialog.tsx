import { X } from 'lucide-react';
import Button from '@/components/bits/Button';
import Modal from '@/components/bits/Modal';

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
    <Modal isOpen={isOpen} onClose={onCancel} className="max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <button
          onClick={onCancel}
          className="rounded-full p-1 text-text-faint hover:bg-surface-alt hover:text-text-muted transition dark:hover:bg-surface-hover dark:hover:text-text"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <p className="text-sm text-text-muted">{message}</p>

      <div className="flex justify-end gap-3 pt-6">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          className={
            destructive
              ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500'
              : undefined
          }
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
