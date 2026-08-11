import { useState, useCallback } from 'react';
import { UploadCloud } from 'lucide-react';

type UploadDropzoneProps = {
  onPick: () => void;
};

export default function UploadDropzone({ onPick }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

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
      // The webview cannot expose absolute file paths for dropped files, so
      // opening the native dialog is the reliable way to pick files.
      onPick();
    },
    [onPick]
  );

  return (
    <div
      className={`group relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-200 ${
        isDragging
          ? 'border-primary bg-gradient-to-br from-primary/5 to-primary/5 shadow-lg dark:border-primary/40 dark:from-primary/10 dark:to-primary/10'
          : 'border-border-strong bg-gradient-to-br from-surface-hover to-surface-alt hover:border-primary hover:from-surface-alt hover:to-surface-hover dark:border-border-strong dark:from-surface dark:to-surface-alt dark:hover:border-primary/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onPick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-3xl pointer-events-none" />

      <div className="flex flex-col items-center gap-5 text-center z-10 px-6 py-12">
        <div
          className={`rounded-2xl p-5 transition-all duration-300 ${
            isDragging
              ? 'scale-110 bg-gradient-to-br from-primary/10 to-primary/10 shadow-xl dark:from-primary/20 dark:to-primary/20 text-primary'
              : 'bg-background shadow-lg text-text-subtle group-hover:shadow-xl group-hover:scale-105'
          }`}
        >
          <UploadCloud className="h-12 w-12" />
        </div>
        <div>
          <span className="text-xl font-bold text-text">
            {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
          </span>
          <p className="mt-2 text-sm text-text-muted leading-relaxed">
            Supports any file type. Maximum size 5GB per file.
          </p>
        </div>
      </div>
    </div>
  );
}
