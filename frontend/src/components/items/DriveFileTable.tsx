import { useState } from 'react';
import {
  Download,
  Trash2,
  Edit2,
  Eye,
  MoreHorizontal,
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
import { formatSize } from '@/lib/files';

export type SortField = 'name' | 'size' | 'date';
export type SortDirection = 'asc' | 'desc';

type DriveFileTableProps = {
  files: FileItem[];
  selectedFileIds: Set<string>;
  onSelectionChange: (id: string, isSelected: boolean) => void;
  onSelectAllChange: (isSelected: boolean) => void;
  onView: (file: FileItem) => void;
  onEdit: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  emptyMessage?: string;
};

type RowActionsProps = {
  file: FileItem;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onView: (file: FileItem) => void;
  onEdit: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
};

function RowActions({
  file,
  isOpen,
  onToggle,
  onClose,
  onView,
  onEdit,
  onDownload,
  onDelete,
}: RowActionsProps) {
  const menuItemClass =
    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-surface-muted/60 dark:hover:bg-surface-alt';

  return (
    <div className="relative flex items-center justify-end gap-1">
      <button
        onClick={() => onDownload(file)}
        className="rounded-lg p-1.5 text-text-faint hover:bg-surface-alt hover:text-emerald-600 dark:hover:bg-surface-alt transition"
        title="Download file"
      >
        <Download className="h-4 w-4" />
      </button>
      <button
        onClick={onToggle}
        className="rounded-lg p-1.5 text-text-faint hover:bg-surface-alt hover:text-text dark:hover:bg-surface-alt transition"
        title="More actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[150px] rounded-xl border border-border bg-background p-1 shadow-lg dark:bg-surface">
            <button type="button" className={menuItemClass} onClick={() => onView(file)}>
              <Eye className="h-4 w-4 text-text-faint" />
              View
            </button>
            <button type="button" className={menuItemClass} onClick={() => onEdit(file)}>
              <Edit2 className="h-4 w-4 text-text-faint" />
              Edit
            </button>
            <button
              type="button"
              className={`${menuItemClass} text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30`}
              onClick={() => onDelete(file)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function DriveFileTable({
  files,
  selectedFileIds,
  onSelectionChange,
  onSelectAllChange,
  onView,
  onEdit,
  onDownload,
  onDelete,
  sortField,
  sortDirection,
  onSortChange,
  emptyMessage = 'No files found. Upload your first file to get started.',
}: DriveFileTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const allSelected = files.length > 0 && selectedFileIds.size === files.length;
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
        {emptyMessage}
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
                onClick={() => onSortChange('name')}
              >
                Name {renderSortIcon('name')}
              </th>
              <th
                className="px-4 py-3.5 font-medium cursor-pointer group select-none whitespace-nowrap hidden lg:table-cell w-44 text-text-faint"
                onClick={() => onSortChange('date')}
              >
                Last Modified {renderSortIcon('date')}
              </th>
              <th
                className="px-4 py-3.5 font-medium cursor-pointer group select-none whitespace-nowrap hidden sm:table-cell w-28 text-text-faint"
                onClick={() => onSortChange('size')}
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
            {files.map((file) => {
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
                    <RowActions
                      file={file}
                      isOpen={openMenuId === file.id}
                      onToggle={() => setOpenMenuId(openMenuId === file.id ? null : file.id)}
                      onClose={() => setOpenMenuId(null)}
                      onView={onView}
                      onEdit={onEdit}
                      onDownload={onDownload}
                      onDelete={onDelete}
                    />
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
