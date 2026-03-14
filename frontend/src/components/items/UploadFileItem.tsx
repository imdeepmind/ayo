import { useState } from 'react';
import { File as FileIcon, Trash2, Edit2, Check, X } from 'lucide-react';
import Button from '@/components/bits/Button';

// Helper to format file size
const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export type UploadFile = {
  id: string;
  file: File;
  customName: string;
};

type UploadFileItemProps = {
  fileInfo: UploadFile;
  onRemove: (id: string) => void;
  onSaveEdit: (id: string, newName: string) => void;
};

export default function UploadFileItem({ fileInfo, onRemove, onSaveEdit }: UploadFileItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(fileInfo.customName);

  const handleSave = () => {
    onSaveEdit(fileInfo.id, editName);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(fileInfo.customName);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80">
      <div className="flex flex-1 items-center gap-4 overflow-hidden">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400">
          <FileIcon className="h-5 w-5" />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {isEditing ? (
            <div className="flex items-center gap-2 pr-4">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full max-w-[300px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
              <Button
                variant="ghost"
                onClick={handleSave}
                className="!p-1.5 border-none text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 bg-transparent dark:bg-transparent"
                title="Save"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancel}
                className="!p-1.5 border-none text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 bg-transparent dark:bg-transparent"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <span
                className="truncate font-medium text-slate-700 dark:text-slate-200"
                title={fileInfo.customName}
              >
                {fileInfo.customName}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatBytes(fileInfo.file.size)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-4">
        {!isEditing && (
          <Button
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="!p-2 border-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-indigo-400 bg-transparent dark:bg-transparent shadow-none"
            title="Rename"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => onRemove(fileInfo.id)}
          className="!p-2 border-none text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 bg-transparent dark:bg-transparent shadow-none"
          title="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
