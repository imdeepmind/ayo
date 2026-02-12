import type { FileItem } from '@/mock-data/files';

type DriveFileTableProps = {
  files: FileItem[];
  onFileClick?: (file: FileItem) => void;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(1)} ${units[index]}`;
}

function getFileIcon(type: FileItem['type']): string {
  switch (type) {
    case 'document':
      return '📄';
    case 'image':
      return '🖼️';
    case 'video':
      return '🎬';
    case 'audio':
      return '🎧';
    case 'archive':
      return '🗜️';
    default:
      return '📁';
  }
}

export default function DriveFileTable({ files, onFileClick }: DriveFileTableProps) {
  return (
    <div className="mt-4">
      {files.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No files match your search.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {files.map((file) => (
            <li
              key={file.id}
              className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-slate-100 shadow-sm shadow-slate-900/40 transition hover:border-sky-500/80 hover:bg-slate-900 hover:shadow-lg"
              onClick={onFileClick ? () => onFileClick(file) : undefined}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-lg">
                  <span aria-hidden="true">{getFileIcon(file.type)}</span>
                </div>
                <span className="text-xs text-slate-400">{formatSize(file.sizeBytes)}</span>
              </div>
              <div className="mb-1 truncate text-xs font-medium text-slate-100">
                {file.name}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate">{file.type}</span>
                <span>{formatDate(file.modifiedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

