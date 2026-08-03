import { Link } from 'react-router-dom';
import { Settings, Loader2 } from 'lucide-react';
import IconButton from '@/components/bits/IconButton';

type DriveStatusBarProps = {
  totalUsedBytes: number;
  activeUploads: number;
  activeDownloads: number;
  activeDeletes: number;
  overallProgress: number | null;
};

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(1)} ${units[index]}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export default function DriveStatusBar({
  totalUsedBytes,
  activeUploads,
  activeDownloads,
  activeDeletes,
  overallProgress,
}: DriveStatusBarProps) {
  const hasTransfers = activeUploads > 0 || activeDownloads > 0 || activeDeletes > 0;

  const statusParts: string[] = [];
  if (activeUploads > 0) statusParts.push(`Uploading ${plural(activeUploads, 'file')}`);
  if (activeDownloads > 0) statusParts.push(`Downloading ${plural(activeDownloads, 'file')}`);
  if (activeDeletes > 0) statusParts.push(`Deleting ${plural(activeDeletes, 'file')}`);
  const statusText = statusParts.join(' · ');
  const progress = overallProgress ?? 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/90 text-xs text-slate-600 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300 w-full">
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 md:px-8 lg:px-16 py-2">
        <div className="flex items-center gap-3">
          <Link to="/settings" aria-label="Open settings">
            <IconButton aria-label="Open settings">
              <Settings className="h-4 w-4" />
            </IconButton>
          </Link>
          <span className="whitespace-nowrap">Storage used: {formatSize(totalUsedBytes)}</span>
        </div>

        {hasTransfers ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 whitespace-nowrap font-medium text-sky-700 dark:text-sky-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {statusText} · {progress}%
            </span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-sky-500 transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="hidden sm:block text-slate-400 dark:text-slate-500">
            {statusText || 'All caught up'}
          </span>
        )}
      </div>
    </div>
  );
}
