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
          ? 'border-sky-500 bg-gradient-to-br from-sky-50 to-blue-50 shadow-lg dark:border-sky-400 dark:from-sky-950/30 dark:to-blue-950/30'
          : 'border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 hover:border-sky-400 hover:from-slate-100 hover:to-slate-50 dark:border-slate-700 dark:from-slate-900/50 dark:to-slate-800/50 dark:hover:border-sky-500'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onPick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-blue-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-3xl pointer-events-none" />

      <div className="flex flex-col items-center gap-5 text-center z-10 px-6 py-12">
        <div
          className={`rounded-2xl p-5 transition-all duration-300 ${
            isDragging
              ? 'scale-110 bg-gradient-to-br from-sky-100 to-blue-100 shadow-xl dark:from-sky-900/50 dark:to-blue-900/50 text-sky-600 dark:text-sky-400'
              : 'bg-white shadow-lg dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:shadow-xl group-hover:scale-105'
          }`}
        >
          <UploadCloud className="h-12 w-12" />
        </div>
        <div>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
          </span>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Supports any file type. Maximum size 5GB per file.
          </p>
        </div>
      </div>
    </div>
  );
}
