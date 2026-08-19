import { Link } from 'react-router-dom';
import { Settings, Loader2 } from 'lucide-react';
import IconButton from '@/components/bits/IconButton';

type UploadProgressItem = {
  name: string;
  progress: number;
};

type DriveStatusBarProps = {
  totalUsedBytes: number;
  uploads: UploadProgressItem[];
  activeDownloads: number;
  activeDeletes: number;
  overallProgress: number | null;
};

// maxVisibleUploads caps how many per-file upload rows are shown in the status
// bar before collapsing into an overflow label.
const maxVisibleUploads = 3;

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
  uploads,
  activeDownloads,
  activeDeletes,
  overallProgress,
}: DriveStatusBarProps) {
  const hasTransfers = uploads.length > 0 || activeDownloads > 0 || activeDeletes > 0;

  const statusParts: string[] = [];
  if (uploads.length > 0) statusParts.push(`Uploading ${plural(uploads.length, 'file')}`);
  if (activeDownloads > 0) statusParts.push(`Downloading ${plural(activeDownloads, 'file')}`);
  if (activeDeletes > 0) statusParts.push(`Deleting ${plural(activeDeletes, 'file')}`);
  const statusText = statusParts.join(' · ');
  const progress = overallProgress ?? 0;

  const visibleUploads = uploads.slice(0, maxVisibleUploads);
  const hiddenUploads = uploads.length - visibleUploads.length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface text-xs text-text-muted backdrop-blur-sm dark:border-border dark:text-text-muted w-full">
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
            <span className="flex items-center gap-1.5 whitespace-nowrap font-medium text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {statusText} · {progress}%
            </span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {visibleUploads.length > 0 && (
              <div className="flex flex-col gap-1 border-l border-border pl-3 dark:border-border-strong">
                {visibleUploads.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="max-w-[140px] truncate text-text-muted" title={item.name}>
                      {item.name}
                    </span>
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-text-subtle">
                      {item.progress}%
                    </span>
                  </div>
                ))}
                {hiddenUploads > 0 && (
                  <span className="text-text-faint dark:text-text-subtle">
                    +{hiddenUploads} more
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="hidden sm:block text-text-faint dark:text-text-subtle">
            {statusText || 'All caught up'}
          </span>
        )}
      </div>
    </div>
  );
}
