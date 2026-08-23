import {
  Box,
  Download,
  File,
  FileText,
  Film,
  Grid3x3,
  HardDrive,
  Headphones,
  Image,
  Server,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { useActiveTransfers } from '@/context/ActiveTransfersContext';
import { useSearch } from '@/context/SearchContext';

import { formatSize, getFileType, type FileItem } from '@/lib/files';

import Button from '@/components/bits/Button';
import ConfirmDialog from '@/components/bits/ConfirmDialog';
import Pagination from '@/components/bits/Pagination';
import DriveFileTable, {
  type SortDirection,
  type SortField,
} from '@/components/items/DriveFileTable';
import DriveToolbar from '@/components/items/DriveToolbar';
import EditFileModal from '@/components/items/EditFileModal';
import FileDetailsModal from '@/components/items/FileDetailsModal';

import {
  DeleteFiles,
  DownloadFiles,
  GetFileDetails,
  GetHomeOverview,
  GetStoredFiles,
  UpdateFile,
} from '../../wailsjs/go/home/Service';
import { home } from '../../wailsjs/go/models';

function toFileItem(stored: home.StoredFile): FileItem {
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalFiles, setTotalFiles] = useState(0);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { refresh, trackJobs, deleteCompletedCount } = useActiveTransfers();

  // Selection state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Editing state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fileToEdit, setFileToEdit] = useState<FileItem | null>(null);

  // Details modal state
  const [detailsModal, setDetailsModal] = useState<{
    file: FileItem;
    details: home.FileDetails | null;
  } | null>(null);

  // Delete confirmation state
  const [deletePending, setDeletePending] = useState<FileItem[] | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const storedPage = await GetStoredFiles(query, sortField, sortDirection, page, pageSize);
      setFiles(storedPage.Files.map(toFileItem));
      setTotalFiles(storedPage.Total);
    } catch (err) {
      console.error('Failed to load stored files:', err);
      toast.error('Failed to load files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [query, sortField, sortDirection, page, pageSize]);

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

  // Start back at the first page whenever the search query changes.
  useEffect(() => {
    setPage(1);
  }, [query]);

  // If the current page ends up empty after a delete, step back one page.
  useEffect(() => {
    if (files.length === 0 && totalFiles > 0 && page > 1) {
      setPage(page - 1);
    }
  }, [files.length, totalFiles, page]);

  // Reload the drive listing whenever a tracked delete completes, so the
  // removed files disappear from the table.
  useEffect(() => {
    if (deleteCompletedCount === 0) return;
    void loadFiles();
    void loadOverview();
  }, [deleteCompletedCount, loadFiles, loadOverview]);

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

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    clearSelection();
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
    clearSelection();
  };

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1);
    clearSelection();
  };

  const handleEdit = (file: FileItem) => {
    setFileToEdit(file);
    setIsEditModalOpen(true);
  };

  const handleDownloadById = async (id: number) => {
    try {
      const jobs = await DownloadFiles([id]);
      trackJobs(jobs);
      toast.success('Download started');
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
      const jobs = await DeleteFiles(ids.map(Number));
      trackJobs(jobs);
    } catch (err) {
      console.error('Failed to delete file:', err);
      toast.error('Failed to delete a file. Please try again.');
      return;
    }
    toast(`Deleting ${ids.length} ${ids.length === 1 ? 'file' : 'files'}…`);
    clearSelection();
  };

  const handleDelete = (file: FileItem) => {
    setDeletePending([file]);
  };

  const handleView = async (file: FileItem) => {
    setDetailsModal({ file, details: null });
    try {
      const details = await GetFileDetails(Number(file.id));
      setDetailsModal((cur) => (cur && cur.file.id === file.id ? { file, details } : cur));
    } catch (err) {
      console.error('Failed to load file details:', err);
      toast.error('Failed to load file details. Please try again.');
      setDetailsModal(null);
    }
  };

  const saveEdit = async (id: string, newName: string, newTags: string[]) => {
    try {
      await UpdateFile(Number(id), newName.trim(), newTags);
      toast.success('File updated successfully');
      await Promise.all([loadFiles(), loadOverview()]);
    } catch (err) {
      console.error('Failed to update file:', err);
      toast.error('Failed to update file. Please try again.');
    }
  };

  const handleBulkDownload = async () => {
    const ids = [...selectedFileIds];
    if (ids.length === 0) return;
    try {
      const jobs = await DownloadFiles(ids.map(Number));
      trackJobs(jobs);
      toast.success(`Downloading ${ids.length} files`);
      refresh();
    } catch (err) {
      console.error('Failed to start downloads:', err);
      toast.error('Failed to start the downloads. Please try again.');
    }
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
    <div className="w-full relative space-y-2">
      {!isSearching && (
        <DriveToolbar activeCategory={activeCategory} onUploadClick={() => navigate('/upload')} />
      )}

      {/* Stats bar */}
      {!isSearching && (
        <section className="flex w-max overflow-hidden rounded-2xl border border-border bg-surface divide-x divide-border">
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
            <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-text-subtle">
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
                    className={`group cursor-pointer rounded-2xl border border-border bg-surface p-3.5 flex flex-col justify-between transition-all hover:bg-surface-hover dark:hover:bg-surface-alt ${
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
        <h2 className="text-lg font-bold text-text">
          {isSearching ? 'Search Results' : 'All Files'}
        </h2>

        {isLoading ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center">
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
            onView={handleView}
            onEdit={handleEdit}
            onDownload={handleDownload}
            onDelete={handleDelete}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            emptyMessage={
              isSearching
                ? 'No files match your search.'
                : 'No files found. Upload your first file to get started.'
            }
          />
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={totalFiles}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
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

      <FileDetailsModal
        isOpen={detailsModal !== null}
        file={detailsModal?.file ?? null}
        details={detailsModal?.details ?? null}
        onClose={() => setDetailsModal(null)}
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
