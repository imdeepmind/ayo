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
} from 'lucide-react';
import { getFileType, type FileItem } from '@/lib/files';
import { EnqueueDelete, EnqueueDownload, GetStoredFiles } from '../../wailsjs/go/upload/Service';
import { upload } from '../../wailsjs/go/models';
import { useActiveTransfers } from '@/context/ActiveTransfersContext';
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

// Default mock recent files matching the reference image layout if no uploaded files exist yet
const mockRecentFiles: FileItem[] = [
  {
    id: 'mock-1',
    name: 'Brief.pdf',
    type: 'document',
    sizeBytes: 1400000,
    modifiedAt: new Date().toISOString(),
    owner: 'You',
    tags: ['pdf'],
  },
  {
    id: 'mock-2',
    name: 'Architecture.jpg',
    type: 'image',
    sizeBytes: 12000000,
    modifiedAt: new Date().toISOString(),
    owner: 'You',
    tags: ['image'],
  },
  {
    id: 'mock-3',
    name: 'Minimalism.jpg',
    type: 'image',
    sizeBytes: 8500000,
    modifiedAt: new Date().toISOString(),
    owner: 'You',
    tags: ['image'],
  },
  {
    id: 'mock-4',
    name: 'WorkContract.pdf',
    type: 'document',
    sizeBytes: 1700000,
    modifiedAt: new Date().toISOString(),
    owner: 'You',
    tags: ['pdf'],
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery] = useState('');
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
      const stored = await GetStoredFiles();
      setFiles(stored.map(toFileItem));
    } catch (err) {
      console.error('Failed to load stored files:', err);
      toast.error('Failed to load files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

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
      toast.success(`File${count === 1 ? '' : 's'} successfully deleted`);
    }
  }, [deletes.length, loadFiles]);

  const filteredFiles = useMemo(() => {
    let result = files;

    // Filter by category
    if (activeCategory === 'recents') {
      result = [...result].sort(
        (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      );
    } else if (activeCategory === 'starred') {
      result = result.filter((f) => f.tags?.includes('starred'));
    }

    // Filter by search query
    const query = searchQuery.trim().toLowerCase();
    if (!query) return result;
    return result.filter((file) => {
      const nameMatch = file.name.toLowerCase().includes(query);
      const typeMatch = file.type.toLowerCase().includes(query);
      const tagMatch = file.tags?.some((tag) => tag.toLowerCase().includes(query));
      return nameMatch || typeMatch || tagMatch;
    });
  }, [searchQuery, files, activeCategory]);

  // Recent files list for top cards
  const recentFilesDisplay = useMemo(() => {
    if (files.length > 0) {
      return files.slice(0, 4);
    }
    return mockRecentFiles;
  }, [files]);

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
      setSelectedFileIds(new Set(filteredFiles.map((f) => f.id)));
    } else {
      setSelectedFileIds(new Set());
    }
  };

  const clearSelection = () => setSelectedFileIds(new Set());

  const handleEdit = (file: FileItem) => {
    setFileToEdit(file);
    setIsEditModalOpen(true);
  };

  const handleDownload = async (file: FileItem) => {
    if (file.id.startsWith('mock-')) {
      toast.success(`Mock file ${file.name} ready`);
      return;
    }
    try {
      const job = await EnqueueDownload(Number(file.id));
      toast.success(`Downloading ${job.CustomName || job.File}`);
      refresh();
    } catch (err) {
      console.error('Failed to start download:', err);
      toast.error('Failed to start the download. Please try again.');
    }
  };

  const deleteFiles = async (ids: string[]) => {
    const realIds = ids.filter((id) => !id.startsWith('mock-'));
    if (realIds.length === 0) {
      toast.success('Deleted file(s)');
      clearSelection();
      return;
    }
    try {
      for (const id of realIds) {
        await EnqueueDelete(Number(id));
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
      toast.error('Failed to delete a file. Please try again.');
      return;
    }
    pendingDeleteCount.current += realIds.length;
    toast(`Deleting ${realIds.length} ${realIds.length === 1 ? 'file' : 'files'}…`);
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

  return (
    <div className="w-full relative space-y-6">
      <DriveToolbar activeCategory={activeCategory} onUploadClick={() => navigate('/upload')} />

      {/* Recent Files Cards Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text">Recent Files</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentFilesDisplay.map((file) => {
            const badge = getCardBadge(file.name, file.type);
            return (
              <div
                key={file.id}
                onClick={() => handleDownload(file)}
                className="group cursor-pointer rounded-2xl border border-border bg-background p-3.5 flex flex-col justify-between h-36 transition-all hover:bg-surface-hover dark:hover:bg-surface-alt"
              >
                {/* Thumbnail Graphic Preview */}
                <div className="w-full flex-1 rounded-xl bg-background flex items-center justify-center border border-border dark:border-border-strong mb-3 overflow-hidden">
                  {file.type === 'image' || file.name.endsWith('.jpg') ? (
                    <div className="w-full h-full bg-gradient-to-tr from-emerald-100 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20 flex items-center justify-center">
                      <Image className="h-8 w-8 text-emerald-500 opacity-80 group-hover:scale-110 transition" />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-surface-hover to-primary/5 dark:from-surface-alt dark:to-primary/10 flex items-center justify-center p-2 text-[8px] text-text-faint font-mono leading-tight">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod...
                    </div>
                  )}
                </div>

                {/* Footer details */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text truncate pr-2">{file.name}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white uppercase shrink-0 ${badge.bg}`}
                  >
                    {badge.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* All Files Listing Section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text">All Files</h2>
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
            files={filteredFiles}
            selectedFileIds={selectedFileIds}
            onSelectionChange={handleSelectionChange}
            onSelectAllChange={handleSelectAllChange}
            onEdit={handleEdit}
            onDownload={handleDownload}
            onDelete={handleDelete}
            viewMode={viewMode}
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
