import { UploadCloud } from 'lucide-react';
import Button from '@/components/bits/Button';

type UploadStickyBarProps = {
  fileCount: number;
  onUpload: () => void;
};

export default function UploadStickyBar({ fileCount, onUpload }: UploadStickyBarProps) {
  if (fileCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 md:px-8">
        <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Ready to upload {fileCount} {fileCount === 1 ? 'file' : 'files'}
        </div>
        <Button type="button" className="px-8 shadow-lg shadow-indigo-500/20" onClick={onUpload}>
          Upload Files
          <UploadCloud className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
