import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Download,
  Trash2,
  FileText,
  Image,
  Film,
  Headphones,
  Box,
  LayoutGrid,
  List,
  File,
  HardDrive,
  Server,
  Grid3x3,
} from 'lucide-react';
import { getFileType, formatSize, type FileItem } from '@/lib/files';
import { EnqueueDelete, EnqueueDownload, GetStoredFiles } from '../../wailsjs/go/upload/Service';
import { GetHomeOverview } from '../../wailsjs/go/home/Service';
import { home, upload } from '../../wailsjs/go/models';
import { useActiveTransfers } from '@/context/ActiveTransfersContext';
import { useSearch } from '@/context/SearchContext';
import DriveToolbar from '@/components/items/DriveToolbar';
import DriveFileTable from '@/components/items/DriveFileTable';
import EditFileModal from '@/components/items/EditFileModal';
import Button from '@/components/bits/Button';
import ConfirmDialog from '@/components/bits/ConfirmDialog';

function toFileItem(stored: upload.StoredFile): FileItem {
  return {
    id: String(stored.ID),
    name: stored.Name,
    type: getFileType(stored.Name),
    sizeBytes: stored.Size,
    modifiedAt: stored.CreatedAt,
    owner: 'You',
    tags: stored.Tags,
  };
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function Home() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [overview, setOverview] = useState<home.HomeOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { query } = useSearch();
  const isSearching = query.trim().length > 0;
  const [activeCategory] = useState('my-drive');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const { deletes, refresh } = useActiveTransfers();

  // Selection state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Editing state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fileToEdit, setFileToEdit] = useState<FileItem | null>(null);

  // Delete confirmation state
  const [deletePending, setDeletePending] = useState<FileItem[] | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const stored = await GetStoredFiles(query);
      setFiles(stored.map(toFileItem));
    } catch (err) {
      console.error('Failed to load stored files:', err);
      toast.error('Failed to load files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await GetHomeOverview());
    } catch (err) {
      console.error('Failed to load home overview:', err);
    }
  }, []);

  useEffect(() => {
    if (isSearching) return;
    loadOverview();
  }, [isSearching, loadOverview]);

  useEffect(() => {
    const timer = setTimeout(loadFiles, isSearching ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadFiles, isSearching]);

  const wasDeleting = useRef(false);
  const pendingDeleteCount = useRef(0);
  useEffect(() => {
    if (deletes.length > 0) {
      wasDeleting.current = true;
    } else if (wasDeleting.current) {
      wasDeleting.current = false;
      const count = pendingDeleteCount.current;
      pendingDeleteCount.current = 0;
      void loadFiles();
      void loadOverview();
      toast.success(`File${count === 1 ? '' : 's'} successfully deleted`);
    }
  }, [deletes.length, loadFiles, loadOverview]);

  // Recent files from the backend home overview, newest first.
  const recentFiles = useMemo(() => overview?.RecentFiles ?? [], [overview]);

  const handleSelectionChange = (id: string, isSelected: boolean) => {
    const next = new Set(selectedFileIds);
    if (isSelected) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedFileIds(next);
  };

  const handleSelectAllChange = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedFileIds(new Set(files.map((f) => f.id)));
    } else {
      setSelectedFileIds(new Set());
    }
  };

  const clearSelection = () => setSelectedFileIds(new Set());

  const handleEdit = (file: FileItem) => {
    setFileToEdit(file);
    setIsEditModalOpen(true);
  };

  const handleDownloadById = async (id: number) => {
    try {
      const job = await EnqueueDownload(id);
      toast.success(`Downloading ${job.CustomName || job.File}`);
      refresh();
    } catch (err) {
      console.error('Failed to start download:', err);
      toast.error('Failed to start the download. Please try again.');
    }
  };

  const handleDownload = (file: FileItem) => {
    void handleDownloadById(Number(file.id));
  };

  const deleteFiles = async (ids: string[]) => {
    try {
      for (const id of ids) {
        await EnqueueDelete(Number(id));
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
      toast.error('Failed to delete a file. Please try again.');
      return;
    }
    pendingDeleteCount.current += ids.length;
    toast(`Deleting ${ids.length} ${ids.length === 1 ? 'file' : 'files'}…`);
    clearSelection();
  };

  const handleDelete = (file: FileItem) => {
    setDeletePending([file]);
  };

  const saveEdit = (id: string, newName: string, newTags: string[]) => {
    void id;
    void newName;
    void newTags;
    toast('Renaming and editing tags is not available yet.');
  };

  const handleBulkDownload = () => {
    toast.success(`Started downloading ${selectedFileIds.size} files`);
    clearSelection();
  };

  const handleBulkDelete = () => {
    const ids = [...selectedFileIds];
    if (ids.length === 0) return;
    setDeletePending(files.filter((f) => ids.includes(f.id)));
  };

  const confirmPendingDelete = () => {
    if (!deletePending) return;
    const ids = deletePending.map((f) => f.id);
    setDeletePending(null);
    void deleteFiles(ids);
  };

  const getCardBadge = (name: string, type: string) => {
    if (name.endsWith('.pdf'))
      return { text: 'PDF', bg: 'bg-primary', icon: <FileText className="h-4 w-4 text-white" /> };
    if (name.endsWith('.jpg') || name.endsWith('.png') || type === 'image')
      return { text: 'JPG', bg: 'bg-emerald-500', icon: <Image className="h-4 w-4 text-white" /> };
    if (name.endsWith('.doc') || name.endsWith('.docx'))
      return { text: 'DOC', bg: 'bg-amber-500', icon: <FileText className="h-4 w-4 text-white" /> };
    if (type === 'video')
      return { text: 'VID', bg: 'bg-purple-500', icon: <Film className="h-4 w-4 text-white" /> };
    if (type === 'audio')
      return {
        text: 'AUD',
        bg: 'bg-amber-500',
        icon: <Headphones className="h-4 w-4 text-white" />,
      };
    return { text: 'FILE', bg: 'bg-slate-600', icon: <Box className="h-4 w-4 text-white" /> };
  };

  const stats = [
    {
      label: 'Files',
      value: String(overview?.TotalFiles ?? 0),
      icon: <File className="h-3.5 w-3.5 text-text" />,
    },
    {
      label: 'Storage',
      value: formatSize(overview?.ActualSizeUsed ?? 0),
      icon: <HardDrive className="h-3.5 w-3.5 text-text" />,
    },
    {
      label: 'Providers',
      value: String(overview?.TotalProviders ?? 0),
      icon: <Server className="h-3.5 w-3.5 text-text" />,
    },
    {
      label: 'Erasure Coding',
      value: overview?.ErasureCodingSetup ?? '0+0',
      icon: <Grid3x3 className="h-3.5 w-3.5 text-text" />,
    },
  ];

  return (
    <div className="w-full relative space-y-6">
      {!isSearching && (
        <DriveToolbar activeCategory={activeCategory} onUploadClick={() => navigate('/upload')} />
      )}

      {/* Stats bar */}
      {!isSearching && (
        <section className="flex w-max overflow-hidden rounded-2xl border border-border bg-background divide-x divide-border">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 px-4 py-3 min-w-0">
              {stat.icon}
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-sm font-bold text-text truncate">{stat.value}</span>
                <span className="text-xs font-medium text-text-faint truncate">{stat.label}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Recent Files Cards Section */}
      {!isSearching && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-text">Recent Files</h2>
          {recentFiles.length === 0 ? (
            <div className="rounded-2xl border border-border bg-background p-6 text-center text-sm text-text-subtle">
              No recent files yet. Upload your first file to get started.
            </div>
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {recentFiles.slice(0, 5).map((file, index) => {
                const type = getFileType(file.Name);
                const badge = getCardBadge(file.Name, type);
                return (
                  <div
                    key={file.ID}
                    onClick={() => handleDownloadById(file.ID)}
                    className={`group cursor-pointer rounded-2xl border border-border bg-background p-3.5 flex flex-col justify-between transition-all hover:bg-surface-hover dark:hover:bg-surface-alt ${
                      index >= 4 ? 'hidden xl:flex' : index >= 3 ? 'hidden lg:flex' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${badge.bg}`}
                      >
                        {badge.icon}
                      </div>
                      <span className="min-w-0 text-sm font-semibold text-text truncate">
                        {file.Name}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                      <span className="font-semibold">{formatSize(file.Size)}</span>
                      <span>{formatDateTime(file.UpdatedAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* All Files Listing Section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text">
            {isSearching ? 'Search Results' : 'All Files'}
          </h2>
          <div className="flex items-center gap-1 bg-surface-alt dark:bg-surface-alt p-1 rounded-xl border border-border dark:border-border-strong">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-text-subtle hover:text-text dark:text-text-subtle dark:hover:text-text transition ${
                viewMode === 'grid' ? 'bg-surface dark:bg-surface-alt text-primary font-bold' : ''
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-text-subtle hover:text-text dark:text-text-subtle dark:hover:text-text transition ${
                viewMode === 'list' ? 'bg-surface dark:bg-surface-alt text-primary font-bold' : ''
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-border bg-background p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-border-strong border-t-primary dark:border-border-strong dark:border-t-primary" />
              <span className="text-sm font-medium text-text-subtle">Loading your files...</span>
            </div>
          </div>
        ) : (
          <DriveFileTable
            files={files}
            selectedFileIds={selectedFileIds}
            onSelectionChange={handleSelectionChange}
            onSelectAllChange={handleSelectAllChange}
            onEdit={handleEdit}
            onDownload={handleDownload}
            onDelete={handleDelete}
            viewMode={viewMode}
            emptyMessage={
              isSearching
                ? 'No files match your search.'
                : 'No files found. Upload your first file to get started.'
            }
          />
        )}
      </section>

      {/* Floating Bulk Action Bar */}
      <div
        className={`
        fixed bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-red-200 bg-background px-5 py-3 shadow-none dark:border-red-900 transition-all duration-200
        ${selectedFileIds.size > 0 ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95 pointer-events-none'}
      `}
      >
        <span className="mr-2 text-sm font-semibold text-red-900 dark:text-red-300">
          {selectedFileIds.size} selected
        </span>
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-3 text-xs text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
          onClick={clearSelection}
        >
          Clear
        </Button>
        <div className="h-4 w-px bg-border dark:bg-border-strong" />
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-3 text-xs"
          onClick={handleBulkDownload}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Download All
        </Button>
        <Button
          type="button"
          className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white"
          onClick={handleBulkDelete}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete All
        </Button>
      </div>

      <EditFileModal
        isOpen={isEditModalOpen}
        file={fileToEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setFileToEdit(null);
        }}
        onSave={saveEdit}
      />

      <ConfirmDialog
        isOpen={deletePending !== null}
        title={deletePending && deletePending.length > 1 ? 'Delete Files' : 'Delete File'}
        message={
          deletePending && deletePending.length > 1
            ? `Delete ${deletePending.length} selected files? This cannot be undone.`
            : `Delete "${deletePending?.[0]?.name}"? This cannot be undone.`
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmPendingDelete}
        onCancel={() => setDeletePending(null)}
      />
    </div>
  );
}
