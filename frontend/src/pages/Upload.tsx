import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '@/components/bits/Button';
import UploadDropzone from '@/components/items/UploadDropzone';
import UploadFileItem, { type UploadFile } from '@/components/items/UploadFileItem';
import PendingUploadItem from '@/components/items/PendingUploadItem';
import UploadStickyBar from '@/components/items/UploadStickyBar';
import { EnqueueFiles, GetPendingJobs, PickFiles } from '../../wailsjs/go/upload/Service';
import { upload } from '../../wailsjs/go/models';

const PENDING_REFRESH_MS = 4000;

export default function Upload() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [pendingJobs, setPendingJobs] = useState<upload.EnqueuedJob[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const loadPendingJobs = async () => {
    try {
      const jobs = await GetPendingJobs();
      setPendingJobs(jobs);
    } catch (err) {
      console.error('Failed to load pending uploads:', err);
    }
  };

  useEffect(() => {
    loadPendingJobs();
    const interval = setInterval(loadPendingJobs, PENDING_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

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
      setFiles([]); // Clear queue after upload
      loadPendingJobs();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(String(err) || 'Failed to queue files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 pb-32">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Upload Files</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Drop files below or click to browse your computer.
        </p>
      </div>

      {/* Dropzone Component */}
      <UploadDropzone onPick={pickFiles} />

      {/* Pending Uploads */}
      {pendingJobs.length > 0 && (
        <div className="mt-10">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Pending Uploads ({pendingJobs.length})
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {pendingJobs.map((job) => (
              <PendingUploadItem key={job.ID} item={job} />
            ))}
          </div>
        </div>
      )}

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
      <UploadStickyBar
        fileCount={files.length}
        onUpload={handleUpload}
        disabled={isPicking || isUploading}
      />
    </div>
  );
}
