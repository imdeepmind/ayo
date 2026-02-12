import { Link } from 'react-router-dom';
import IconButton from '@/components/bits/IconButton';

type DriveStatusBarProps = {
  totalUsedBytes: number;
  selectionSummary?: string;
};

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(1)} ${units[index]}`;
}

export default function DriveStatusBar({
  totalUsedBytes,
  selectionSummary,
}: DriveStatusBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/90 text-xs text-slate-600 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300 w-full">
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 md:px-8 lg:px-16 py-2">
        <div className="flex items-center gap-3">
          <Link to="/settings" aria-label="Open settings">
            <IconButton aria-label="Open settings">
              <span aria-hidden="true">⚙️</span>
            </IconButton>
          </Link>
          <span className="whitespace-nowrap">
            Storage used: {formatSize(totalUsedBytes)}
          </span>
        </div>

        <div className="hidden text-right text-xs text-slate-500 sm:block dark:text-slate-400">
          {selectionSummary ?? 'No file selected'}
        </div>
      </div>
    </div>
  );
}

