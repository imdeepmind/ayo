import { Plus } from 'lucide-react';

type DriveToolbarProps = {
  activeCategory?: string;
  onUploadClick: () => void;
};

export default function DriveToolbar({
  activeCategory = 'my-drive',
  onUploadClick,
}: DriveToolbarProps) {
  const getCategoryTitle = (cat: string) => {
    switch (cat) {
      case 'computers':
        return 'Computers';
      case 'shared':
        return 'Shared With Me';
      case 'recents':
        return 'Recent Files';
      case 'starred':
        return 'Starred Files';
      case 'deleted':
        return 'Deleted Files';
      default:
        return 'My Drive';
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      {/* Title + Plus button */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-text">{getCategoryTitle(activeCategory)}</h1>
        <button
          type="button"
          onClick={onUploadClick}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-hover active:scale-95 transition"
          title="Upload new file"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
