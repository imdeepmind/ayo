import { UploadCloud, Loader2 } from 'lucide-react';

const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export type PendingUpload = {
  ID: number;
  File: string;
  CustomName: string;
  Size: number;
  Status: string;
  Progress: number;
  Tags: string[];
};

type PendingUploadItemProps = {
  item: PendingUpload;
};

export default function PendingUploadItem({ item }: PendingUploadItemProps) {
  const isProcessing = item.Status === 'processing';
  const progress = Math.min(100, Math.max(0, item.Progress));

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80">
      <div className="flex flex-1 items-center gap-4 overflow-hidden">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400">
          <UploadCloud className="h-5 w-5" />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <span
            className="truncate font-medium text-slate-700 dark:text-slate-200"
            title={item.CustomName || item.File}
          >
            {item.CustomName || item.File}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatBytes(item.Size)}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                isProcessing
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              }`}
            >
              {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
              {isProcessing ? 'Uploading' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex w-40 shrink-0 flex-col items-end gap-1 pl-4">
        <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
          {progress}%
        </span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
