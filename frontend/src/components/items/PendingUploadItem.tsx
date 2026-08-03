import { UploadCloud, DownloadCloud, Loader2 } from 'lucide-react';

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
  Type: string;
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
  const isDownload = item.Type === 'download';
  const isProcessing = item.Status === 'processing';
  const isCompleted = item.Status === 'completed';
  const progress = Math.min(100, Math.max(0, item.Progress));

  const actionLabel = isCompleted
    ? 'Saving…'
    : isProcessing
      ? isDownload
        ? 'Downloading'
        : 'Uploading'
      : 'Pending';

  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm p-5 shadow-lg transition-all duration-200 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800/90">
      <div className="flex flex-1 items-center gap-4 overflow-hidden">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 text-sky-600 shadow-inner dark:from-sky-900/50 dark:to-blue-900/50 dark:text-sky-400">
          {isDownload ? <DownloadCloud className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <span
            className="truncate text-base font-bold text-slate-800 dark:text-slate-100"
            title={item.CustomName || item.File}
          >
            {item.CustomName || item.File}
          </span>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {formatBytes(item.Size)}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                isProcessing
                  ? 'bg-gradient-to-r from-sky-100 to-blue-100 text-sky-700 dark:from-sky-900/40 dark:to-blue-900/40 dark:text-sky-300'
                  : isCompleted
                    ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-900/40 dark:to-teal-900/40 dark:text-emerald-300'
                    : 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 dark:from-amber-900/40 dark:to-yellow-900/40 dark:text-amber-300'
              }`}
            >
              {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {actionLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="flex w-44 shrink-0 flex-col items-end gap-2 pl-4">
        <span className="text-base font-bold tabular-nums text-slate-800 dark:text-slate-100">
          {progress}%
        </span>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500 transition-[width] duration-500 shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
