import Button from '@/components/bits/Button';
import SearchInput from '@/components/bits/SearchInput';

type DriveToolbarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onUploadClick: () => void;
};

export default function DriveToolbar({
  searchQuery,
  onSearchChange,
  onUploadClick,
}: DriveToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b-2 border-slate-200 pb-5 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Drive</div>

      <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search in Drive"
          className="w-full max-w-sm"
        />
        <Button type="button" onClick={onUploadClick} className="whitespace-nowrap">
          Upload
        </Button>
      </div>
    </div>
  );
}
