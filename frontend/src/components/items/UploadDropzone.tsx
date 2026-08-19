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
      onPick();
    },
    [onPick]
  );

  return (
    <div
      className={`group relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed transition-all duration-200 ${
        isDragging
          ? 'border-primary bg-surface-alt shadow-xl'
          : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-hover'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onPick}
    >
      <div className="flex flex-col items-center gap-5 text-center z-10 px-6 py-12">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-300 ${
            isDragging
              ? 'scale-105 border-primary/50 bg-primary/20 text-primary shadow-xl'
              : 'border-border-strong bg-surface-alt text-primary shadow-sm group-hover:scale-105 group-hover:border-primary/40'
          }`}
        >
          <UploadCloud className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">
            {isDragging ? (
              'Drop files here'
            ) : (
              <>
                Drop files here or click to{' '}
                <span className="text-primary font-bold hover:underline">browse</span>
              </>
            )}
          </h2>
          <p className="mt-2 text-sm text-text-muted">Supports any file type.</p>
        </div>
      </div>
    </div>
  );
}
