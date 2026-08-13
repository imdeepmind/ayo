import { useState } from 'react';
import toast from 'react-hot-toast';
import { toErrorMessage } from '@/lib/errors';
import Button from '@/components/bits/Button';
import UploadDropzone from '@/components/items/UploadDropzone';
import UploadFileItem, { type UploadFile } from '@/components/items/UploadFileItem';
import PendingUploadItem from '@/components/items/PendingUploadItem';
import UploadStickyBar from '@/components/items/UploadStickyBar';
import { useActiveTransfers } from '@/context/ActiveTransfersContext';
import { EnqueueFiles, PickFiles } from '../../wailsjs/go/upload/Service';
import { upload } from '../../wailsjs/go/models';

export default function Upload() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { transfers, refresh, trackJobs } = useActiveTransfers();

  const pickFiles = async () => {
    if (isPicking) return;
    setIsPicking(true);
    try {
      const picked = await PickFiles();
      if (picked.length === 0) return;
      const uploadFiles: UploadFile[] = picked.map((file) => ({
        id: crypto.randomUUID(),
        name: file.Name,
        path: file.Path,
        size: file.Size,
        customName: file.Name,
        tags: [],
      }));
      setFiles((prev) => [...prev, ...uploadFiles]);
    } catch (err) {
      console.error('Failed to pick files:', err);
      toast.error('Failed to open file picker. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const saveEdit = (id: string, newName: string, newTags: string[]) => {
    if (!newName.trim()) {
      toast.error('File name cannot be empty');
      return;
    }
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, customName: newName.trim(), tags: newTags } : f))
    );
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('No files to upload');
      return;
    }
    setIsUploading(true);
    try {
      const jobs = await EnqueueFiles(
        new upload.EnqueueFilesInput({
          Files: files.map(
            (f) =>
              new upload.EnqueueFileInput({
                Name: f.name,
                CustomName: f.customName,
                Path: f.path,
                Size: f.size,
                Tags: f.tags,
              })
          ),
        })
      );
      toast.success(`Queued ${jobs.length} ${jobs.length === 1 ? 'file' : 'files'} for upload`);
      trackJobs(jobs);
      setFiles([]); // Clear queue after upload
      refresh();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(toErrorMessage(err, 'Failed to queue files. Please try again.'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 md:px-8 pb-32">
      <div className="mb-10">
        <h1 className="mb-3 text-3xl font-bold text-text">Upload Files</h1>
        <p className="text-base text-text-muted leading-relaxed">
          Drop files below or click to browse your computer.
        </p>
      </div>

      {/* Dropzone Component */}
      <UploadDropzone onPick={pickFiles} />

      {/* Active Transfers */}
      {transfers.length > 0 && (
        <div className="mt-12">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-text">Active Transfers ({transfers.length})</h2>
          </div>

          <div className="flex flex-col gap-4">
            {transfers.map((job) => (
              <PendingUploadItem key={job.ID} item={job} />
            ))}
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-12">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-text">Selected Files ({files.length})</h2>
            <Button
              variant="ghost"
              onClick={() => setFiles([])}
              className="px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
            >
              Clear All
            </Button>
          </div>

          <div className="flex flex-col gap-4">
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
      <UploadStickyBar
        fileCount={files.length}
        onUpload={handleUpload}
        disabled={isPicking || isUploading}
      />
    </div>
  );
}
