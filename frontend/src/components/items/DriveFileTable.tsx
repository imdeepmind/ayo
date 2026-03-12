import { useState } from 'react';
import {
  Download,
  Trash2,
  Edit2,
  File as FileIcon,
  Image,
  Film,
  Headphones,
  Box,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { FileItem } from '@/mock-data/files';

type SortField = 'name' | 'size' | 'date';
type SortDirection = 'asc' | 'desc';

type DriveFileTableProps = {
  files: FileItem[];
  selectedFileIds: Set<string>;
  onSelectionChange: (id: string, isSelected: boolean) => void;
  onSelectAllChange: (isSelected: boolean) => void;
  onEdit: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
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

export default function DriveFileTable({
  files,
  selectedFileIds,
  onSelectionChange,
  onSelectAllChange,
  onEdit,
  onDownload,
  onDelete,
}: DriveFileTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = a.sizeBytes - b.sizeBytes;
        break;
      case 'date':
        comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const allSelected = sortedFiles.length > 0 && selectedFileIds.size === sortedFiles.length;
  const someSelected = selectedFileIds.size > 0 && !allSelected;

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field)
      return (
        <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-40 group-hover:opacity-100 transition" />
      );
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 inline ml-1 text-sky-500" />
    ) : (
      <ArrowDown className="h-3 w-3 inline ml-1 text-sky-500" />
    );
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="h-4 w-4 text-emerald-500" />;
      case 'video':
        return <Film className="h-4 w-4 text-purple-500" />;
      case 'audio':
        return <Headphones className="h-4 w-4 text-amber-500" />;
      case 'archive':
        return <Box className="h-4 w-4 text-rose-500" />;
      default:
        return <FileIcon className="h-4 w-4 text-sky-500" />;
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-sm overflow-hidden">
      {files.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          No files match your criteria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={(e) => onSelectAllChange(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700"
                  />
                </th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer group select-none whitespace-nowrap"
                  onClick={() => handleSort('name')}
                >
                  Name {renderSortIcon('name')}
                </th>
                <th className="px-4 py-3 font-medium cursor-pointer group select-none hidden md:table-cell w-48">
                  Tags
                </th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer group select-none whitespace-nowrap hidden sm:table-cell w-28"
                  onClick={() => handleSort('size')}
                >
                  Size {renderSortIcon('size')}
                </th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer group select-none whitespace-nowrap hidden lg:table-cell w-36"
                  onClick={() => handleSort('date')}
                >
                  Upload Date {renderSortIcon('date')}
                </th>
                <th className="px-4 py-3 font-medium text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {sortedFiles.map((file) => (
                <tr
                  key={file.id}
                  className={`group transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${selectedFileIds.has(file.id) ? 'bg-sky-50/50 dark:bg-sky-900/10' : ''}`}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedFileIds.has(file.id)}
                      onChange={(e) => onSelectionChange(file.id, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100 max-w-xs truncate">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                        {getFileIcon(file.type)}
                      </div>
                      <span className="font-medium truncate">{file.name}</span>
                    </div>
                    {/* Mobile Only Metadata */}
                    <div className="mt-1 flex gap-3 text-[11px] text-slate-500 sm:hidden">
                      <span>{formatSize(file.sizeBytes)}</span>
                      <span>{formatDate(file.modifiedAt)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {file.tags?.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                      {file.tags && file.tags.length > 3 && (
                        <span className="inline-block rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 border-dashed">
                          +{file.tags.length - 3}
                        </span>
                      )}
                      {(!file.tags || file.tags.length === 0) && (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell text-xs whitespace-nowrap">
                    {formatSize(file.sizeBytes)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden lg:table-cell text-xs whitespace-nowrap">
                    {formatDate(file.modifiedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 transition">
                      <button
                        onClick={() => onEdit(file)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-700 transition"
                        title="Edit file"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDownload(file)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-500 dark:hover:bg-slate-700 transition"
                        title="Download file"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(file)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/40 transition"
                        title="Delete file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
