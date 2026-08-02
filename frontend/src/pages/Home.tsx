import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Trash2 } from 'lucide-react';
import { calculateTotalUsedBytes, getFileType, type FileItem } from '@/lib/files';
import { DeleteStoredFile, GetStoredFiles } from '../../wailsjs/go/upload/Service';
import { upload } from '../../wailsjs/go/models';
import DriveToolbar from '@/components/items/DriveToolbar';
import DriveFileTable from '@/components/items/DriveFileTable';
import DriveStatusBar from '@/components/items/DriveStatusBar';
import EditFileModal from '@/components/items/EditFileModal';
import Button from '@/components/bits/Button';

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

export default function Home() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Editing state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fileToEdit, setFileToEdit] = useState<FileItem | null>(null);

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

  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return files;
    return files.filter((file) => {
      const nameMatch = file.name.toLowerCase().includes(query);
      const typeMatch = file.type.toLowerCase().includes(query);
      const tagMatch = file.tags?.some((tag) => tag.toLowerCase().includes(query));
      return nameMatch || typeMatch || tagMatch;
    });
  }, [searchQuery, files]);

  const totalUsedBytes = useMemo(() => calculateTotalUsedBytes(files), [files]);

  // -- Handlers --

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

  // -- Row Actions --

  const handleEdit = (file: FileItem) => {
    setFileToEdit(file);
    setIsEditModalOpen(true);
  };

  const handleDownload = (file: FileItem) => {
    toast.success(`Started downloading: ${file.name}`);
  };

  const deleteFiles = async (ids: string[]) => {
    for (const id of ids) {
      try {
        await DeleteStoredFile(Number(id));
      } catch (err) {
        console.error('Failed to delete file:', err);
        toast.error('Failed to delete a file. Please try again.');
        return;
      }
    }
    const count = ids.length;
    toast.success(`Deleted ${count} ${count === 1 ? 'file' : 'files'}`);
    clearSelection();
    await loadFiles();
  };

  const handleDelete = async (file: FileItem) => {
    if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    await deleteFiles([file.id]);
  };

  const saveEdit = (id: string, newName: string, newTags: string[]) => {
    void id;
    void newName;
    void newTags;
    toast('Renaming and editing tags is not available yet.');
  };

  // -- Bulk Actions --

  const handleBulkDownload = () => {
    toast.success(`Started downloading ${selectedFileIds.size} files`);
    clearSelection();
  };

  const handleBulkDelete = async () => {
    const count = selectedFileIds.size;
    if (
      !window.confirm(
        `Delete ${count} selected ${count === 1 ? 'file' : 'files'}? This cannot be undone.`
      )
    ) {
      return;
    }
    await deleteFiles([...selectedFileIds]);
  };

  return (
    <div className="w-full relative">
      <div className="relative w-full pb-16">
        <div className="mx-auto w-full px-4 pt-6 md:px-8 lg:px-16">
          <DriveToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onUploadClick={() => {
              navigate('/upload');
            }}
          />

          <div className="relative w-full">
            {/* Bulk Action Bar */}
            <div
              className={`
              fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-5 py-3 shadow-xl backdrop-blur-md transition-all duration-300 dark:border-sky-800 dark:bg-slate-900/90
              ${selectedFileIds.size > 0 ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95 pointer-events-none'}
            `}
            >
              <span className="mr-2 text-sm font-medium text-sky-800 dark:text-sky-300">
                {selectedFileIds.size} selected
              </span>
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-3 text-xs text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:text-sky-400 dark:hover:bg-sky-900/40 dark:hover:text-sky-300"
                onClick={clearSelection}
              >
                Clear
              </Button>
              <div className="h-4 w-px bg-sky-200 dark:bg-sky-800/50" />
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
                className="h-8 px-3 text-xs bg-red-500 hover:bg-red-600 focus:ring-red-500"
                onClick={handleBulkDelete}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete All
              </Button>
            </div>

            {isLoading ? (
              <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-sm px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading your files...
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
              />
            )}
          </div>
        </div>

        <DriveStatusBar totalUsedBytes={totalUsedBytes} />
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
    </div>
  );
}
