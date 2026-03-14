import { useState, useRef, useCallback } from 'react';
import { UploadCloud } from 'lucide-react';

type UploadDropzoneProps = {
  onFilesSelected: (files: File[]) => void;
};

export default function UploadDropzone({ onFilesSelected }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFilesSelected(Array.from(e.dataTransfer.files));
      }
    },
    [onFilesSelected]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
    // Reset input to allow selecting the same file again if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      className={`group relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 ${
        isDragging
          ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20'
          : 'border-slate-300 bg-slate-100 hover:border-indigo-400 hover:bg-slate-200/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-indigo-500'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-2xl pointer-events-none" />

      <div className="flex flex-col items-center gap-4 text-center z-10 px-6 py-10">
        <div
          className={`rounded-full p-4 transition-transform duration-300 ${
            isDragging
              ? 'scale-110 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
              : 'bg-white shadow-sm dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
        >
          <UploadCloud className="h-10 w-10" />
        </div>
        <div>
          <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">
            {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
          </span>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Supports any file type. Maximum size 5GB per file.
          </p>
        </div>
      </div>
      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
      />
    </div>
  );
}
