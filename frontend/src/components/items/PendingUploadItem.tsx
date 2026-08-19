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
    <div className="flex items-center justify-between rounded-2xl border border-border bg-surface backdrop-blur-sm p-5 transition-all duration-200 dark:border-border-strong">
      <div className="flex flex-1 items-center gap-4 overflow-hidden">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
          {isDownload ? <DownloadCloud className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <span
            className="truncate text-base font-bold text-text"
            title={item.CustomName || item.File}
          >
            {item.CustomName || item.File}
          </span>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="text-sm font-medium text-text-muted">{formatBytes(item.Size)}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                isProcessing
                  ? 'bg-gradient-to-r from-primary/10 to-primary/10 text-primary dark:from-primary/20 dark:to-primary/20'
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
        <span className="text-base font-bold tabular-nums text-text">{progress}%</span>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted shadow-inner">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
