import { UploadCloud } from 'lucide-react';
import Button from '@/components/bits/Button';

type UploadStickyBarProps = {
  fileCount: number;
  onUpload: () => void;
  disabled?: boolean;
};

export default function UploadStickyBar({ fileCount, onUpload, disabled }: UploadStickyBarProps) {
  if (fileCount === 0) return null;

  return (
    <div className="fixed bottom-10 left-0 right-0 z-40 border-t-2 border-slate-200 bg-white/95 p-5 backdrop-blur-lg shadow-2xl dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 md:px-8">
        <div className="text-base font-bold text-slate-800 dark:text-slate-100">
          Ready to upload {fileCount} {fileCount === 1 ? 'file' : 'files'}
        </div>
        <Button type="button" className="px-8 shadow-xl" onClick={onUpload} disabled={disabled}>
          Upload Files
          <UploadCloud className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
