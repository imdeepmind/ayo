import { useState } from 'react';
import toast from 'react-hot-toast';
import Button from '@/components/bits/Button';
import UploadDropzone from '@/components/items/UploadDropzone';
import UploadFileItem, { type UploadFile } from '@/components/items/UploadFileItem';
import UploadStickyBar from '@/components/items/UploadStickyBar';

export default function Upload() {
  const [files, setFiles] = useState<UploadFile[]>([]);

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      customName: file.name,
    }));
    setFiles((prev) => [...prev, ...uploadFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const saveEdit = (id: string, newName: string) => {
    if (!newName.trim()) {
      toast.error('File name cannot be empty');
      return;
    }
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, customName: newName.trim() } : f)));
  };

  const handleUpload = () => {
    if (files.length === 0) {
      toast.error('No files to upload');
      return;
    }
    // TODO: Implement actual upload logic
    toast.success(`Started uploading ${files.length} files`);
    setFiles([]); // Clear queue after upload
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 pb-32">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Upload Files</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Drag and drop files below or click to browse your computer.
        </p>
      </div>

      {/* Dropzone Component */}
      <UploadDropzone onFilesSelected={addFiles} />

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Selected Files ({files.length})
            </h2>
            <Button
              variant="ghost"
              onClick={() => setFiles([])}
              className="px-3 py-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
            >
              Clear All
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {files.map((fileInfo) => (
              <UploadFileItem
                key={fileInfo.id}
                fileInfo={fileInfo}
                onRemove={removeFile}
                onSaveEdit={saveEdit}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sticky Bottom Actions Component */}
      <UploadStickyBar fileCount={files.length} onUpload={handleUpload} />
    </div>
  );
}
