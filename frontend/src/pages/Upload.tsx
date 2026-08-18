import { useState } from 'react';
import { Lock, Layers, Cloud, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { toErrorMessage } from '@/lib/errors';
import Button from '@/components/bits/Button';
import UploadDropzone from '@/components/items/UploadDropzone';
import UploadFileItem, { type UploadFile } from '@/components/items/UploadFileItem';
import PendingUploadItem from '@/components/items/PendingUploadItem';
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
    <div className="w-full relative space-y-6">
      <div className="py-2">
        <h1 className="text-2xl font-bold text-text">Upload Files</h1>
        <p className="mt-1 text-sm text-text-muted leading-relaxed">
          Drop files below or click to browse your computer.
        </p>
      </div>

      {/* Dropzone Component */}
      <UploadDropzone onPick={pickFiles} />

      {/* Default State: Feature Cards & Provider Details */}
      {files.length === 0 && (
        <>
          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#260913] border border-[#480c1e] text-primary">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">End-to-End Encrypted</h3>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">
                  Files are encrypted on-device before upload.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#260913] border border-[#480c1e] text-primary">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Erasure Coded</h3>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">
                  Files are split and protected using 2+2 erasure coding.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#260913] border border-[#480c1e] text-primary">
                <Cloud className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Distributed Storage</h3>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">
                  Stored across providers for security.
                </p>
              </div>
            </div>
          </div>

          {/* Provider Details Bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-border bg-surface px-6 py-4 text-xs font-semibold shadow-sm">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="font-bold text-text">Storage Providers</span>
              <span className="inline-flex items-center gap-2 font-normal text-text-muted">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                <span className="font-semibold text-text">1 of 1 providers connected</span>
              </span>
              <span className="hidden sm:inline-block h-4 w-px bg-border mx-2" />
              <span className="text-text-muted">
                Erasure Coding: <span className="font-bold text-text">2+2</span>
              </span>
              <span className="hidden sm:inline-block h-4 w-px bg-border mx-2" />
              <span className="text-text-muted">
                Encryption: <span className="font-bold text-emerald-500">Enabled</span>
              </span>
            </div>
          </div>
        </>
      )}

      {/* Active Transfers */}
      {transfers.length > 0 && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-text">Active Transfers ({transfers.length})</h2>
          </div>

          <div className="flex flex-col gap-3">
            {transfers.map((job) => (
              <PendingUploadItem key={job.ID} item={job} />
            ))}
          </div>
        </div>
      )}

      {/* Selected Files List (when files picked) */}
      {files.length > 0 && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-text">Selected Files ({files.length})</h2>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setFiles([])}
                className="px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/10 bg-transparent shadow-none"
              >
                Clear All
              </Button>
              <Button
                type="button"
                onClick={handleUpload}
                disabled={isPicking || isUploading}
                className="px-6 py-2 text-sm shadow-md"
              >
                Upload Files
                <UploadCloud className="ml-2 h-4 w-4" />
              </Button>
            </div>
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
    </div>
  );
}
