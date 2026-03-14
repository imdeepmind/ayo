import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Trash2 } from 'lucide-react';
import { files as initialFiles, calculateTotalUsedBytes, type FileItem } from '@/mock-data/files';
import DriveToolbar from '@/components/items/DriveToolbar';
import DriveFileTable from '@/components/items/DriveFileTable';
import DriveStatusBar from '@/components/items/DriveStatusBar';
import EditFileModal from '@/components/items/EditFileModal';
import Button from '@/components/bits/Button';

export default function Home() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Editing state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fileToEdit, setFileToEdit] = useState<FileItem | null>(null);

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

  const handleDelete = (file: FileItem) => {
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    toast.success(`Deleted: ${file.name}`);
    if (selectedFileIds.has(file.id)) {
      handleSelectionChange(file.id, false);
    }
  };

  const saveEdit = (id: string, newName: string, newTags: string[]) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName, tags: newTags } : f)));
    toast.success('File updated successfully');
  };

  // -- Bulk Actions --

  const handleBulkDownload = () => {
    toast.success(`Started downloading ${selectedFileIds.size} files`);
    clearSelection();
  };

  const handleBulkDelete = () => {
    setFiles((prev) => prev.filter((f) => !selectedFileIds.has(f.id)));
    toast.success(`Deleted ${selectedFileIds.size} files`);
    clearSelection();
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

            <DriveFileTable
              files={filteredFiles}
              selectedFileIds={selectedFileIds}
              onSelectionChange={handleSelectionChange}
              onSelectAllChange={handleSelectAllChange}
              onEdit={handleEdit}
              onDownload={handleDownload}
              onDelete={handleDelete}
            />
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
