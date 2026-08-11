import { useState } from 'react';
import {
  Download,
  Trash2,
  Edit2,
  Image,
  Film,
  Headphones,
  Box,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
} from 'lucide-react';
import type { FileItem } from '@/lib/files';

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
  viewMode?: 'list' | 'grid';
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
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
  return `${value.toFixed(1)}${units[index]}`;
}

export default function DriveFileTable({
  files,
  selectedFileIds,
  onSelectionChange,
  onSelectAllChange,
  onEdit,
  onDownload,
  onDelete,
  viewMode = 'list',
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
      <ArrowUp className="h-3 w-3 inline ml-1 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 inline ml-1 text-primary" />
    );
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'image':
        return {
          bg: 'bg-emerald-500',
          text: 'PDF',
          icon: <Image className="h-4 w-4 text-white" />,
          label: 'Image',
        };
      case 'video':
        return {
          bg: 'bg-purple-500',
          text: 'VID',
          icon: <Film className="h-4 w-4 text-white" />,
          label: 'Video',
        };
      case 'audio':
        return {
          bg: 'bg-amber-500',
          text: 'AUD',
          icon: <Headphones className="h-4 w-4 text-white" />,
          label: 'Audio',
        };
      case 'archive':
        return {
          bg: 'bg-slate-600',
          text: 'ZIP',
          icon: <Box className="h-4 w-4 text-white" />,
          label: 'Folder',
        };
      default:
        return {
          bg: 'bg-primary',
          text: 'PDF',
          icon: <FileText className="h-4 w-4 text-white" />,
          label: 'PDF',
        };
    }
  };

  if (files.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-12 text-center text-sm text-text-subtle">
        No files found. Upload your first file to get started.
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedFiles.map((file) => {
          const badge = getBadgeStyle(file.type);
          const isSelected = selectedFileIds.has(file.id);

          return (
            <div
              key={file.id}
              className={`group relative flex flex-col justify-between rounded-2xl border border-border bg-background p-4 transition-all hover:bg-surface-hover dark:hover:bg-surface-alt ${
                isSelected ? 'ring-2 ring-primary/60 bg-primary/5' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onSelectionChange(file.id, e.target.checked)}
                  className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary dark:border-border-input dark:bg-surface-alt"
                />
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase text-white ${badge.bg}`}
                >
                  {file.name.endsWith('.pdf')
                    ? 'PDF'
                    : file.name.endsWith('.jpg') || file.name.endsWith('.png')
                      ? 'JPG'
                      : file.name.endsWith('.doc') || file.name.endsWith('.docx')
                        ? 'DOC'
                        : badge.label}
                </span>
              </div>

              <div className="my-4 flex items-center justify-center h-24 rounded-xl bg-surface-alt dark:bg-surface-alt">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${badge.bg}`}
                >
                  {badge.icon}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-semibold text-text truncate">{file.name}</p>
                  <p className="text-xs text-text-faint mt-0.5">{formatSize(file.sizeBytes)}</p>
                </div>
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                  <button
                    onClick={() => onDownload(file)}
                    className="p-1.5 rounded-lg text-text-faint hover:bg-surface-muted/60 hover:text-primary dark:hover:bg-surface-hover"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(file)}
                    className="p-1.5 rounded-lg text-text-faint hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-xs font-semibold text-text-faint uppercase tracking-wider">
              <th className="px-4 py-3.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAllChange(e.target.checked)}
                  className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary dark:border-border-input dark:bg-surface-alt"
                />
              </th>
              <th
                className="px-4 py-3.5 font-medium cursor-pointer group select-none whitespace-nowrap"
                onClick={() => handleSort('name')}
              >
                Name {renderSortIcon('name')}
              </th>
              <th
                className="px-4 py-3.5 font-medium cursor-pointer group select-none whitespace-nowrap hidden lg:table-cell w-44 text-text-faint"
                onClick={() => handleSort('date')}
              >
                Last Modified {renderSortIcon('date')}
              </th>
              <th
                className="px-4 py-3.5 font-medium cursor-pointer group select-none whitespace-nowrap hidden sm:table-cell w-28 text-text-faint"
                onClick={() => handleSort('size')}
              >
                Size {renderSortIcon('size')}
              </th>
              <th className="px-4 py-3.5 font-medium whitespace-nowrap hidden md:table-cell w-28 text-text-faint">
                Type
              </th>
              <th className="px-4 py-3.5 font-medium text-right w-28 text-text-faint">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedFiles.map((file) => {
              const badge = getBadgeStyle(file.type);
              const isSelected = selectedFileIds.has(file.id);
              const displayType = file.name.endsWith('.pdf')
                ? 'PDF'
                : file.name.endsWith('.jpg') || file.name.endsWith('.png')
                  ? 'Image'
                  : file.name.endsWith('.doc') || file.name.endsWith('.docx')
                    ? 'Folder'
                    : badge.label;

              return (
                <tr
                  key={file.id}
                  className={`group transition hover:bg-surface-hover/80 dark:hover:bg-surface-alt/50 ${
                    isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                  }`}
                >
                  <td className="px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectionChange(file.id, e.target.checked)}
                      className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary dark:border-border-input dark:bg-surface-alt"
                    />
                  </td>
                  <td className="px-4 py-3.5 text-text max-w-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${badge.bg}`}
                      >
                        {badge.icon}
                      </div>
                      <span className="font-semibold text-text truncate">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-text-muted hidden lg:table-cell text-sm font-medium whitespace-nowrap">
                    {formatDate(file.modifiedAt)}
                  </td>
                  <td className="px-4 py-3.5 text-text-muted hidden sm:table-cell text-sm font-semibold whitespace-nowrap">
                    {formatSize(file.sizeBytes)}
                  </td>
                  <td className="px-4 py-3.5 text-text-muted hidden md:table-cell text-sm font-medium whitespace-nowrap">
                    {displayType}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(file)}
                        className="rounded-lg p-1.5 text-text-faint hover:bg-surface-alt hover:text-primary dark:hover:bg-surface-alt transition"
                        title="Edit file"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDownload(file)}
                        className="rounded-lg p-1.5 text-text-faint hover:bg-surface-alt hover:text-emerald-600 dark:hover:bg-surface-alt transition"
                        title="Download file"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(file)}
                        className="rounded-lg p-1.5 text-text-faint hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/40 transition"
                        title="Delete file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
