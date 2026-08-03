import { useState } from 'react';
import { File as FileIcon, Trash2, Edit2, Check, X, Tag as TagIcon } from 'lucide-react';
import Button from '@/components/bits/Button';

// Helper to format file size
const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export type UploadFile = {
  id: string;
  name: string;
  path: string;
  size: number;
  customName: string;
  tags: string[];
};

type UploadFileItemProps = {
  fileInfo: UploadFile;
  onRemove: (id: string) => void;
  onSaveEdit: (id: string, newName: string, newTags: string[]) => void;
};

export default function UploadFileItem({ fileInfo, onRemove, onSaveEdit }: UploadFileItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(fileInfo.customName);
  const [editTags, setEditTags] = useState<string[]>(fileInfo.tags);
  const [newTag, setNewTag] = useState('');

  const handleSave = () => {
    onSaveEdit(fileInfo.id, editName, editTags);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(fileInfo.customName);
    setEditTags(fileInfo.tags);
    setNewTag('');
    setIsEditing(false);
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags([...editTags, trimmed]);
    }
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag));
  };

  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm p-5 shadow-lg transition-all duration-200 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800/90">
      <div className="flex flex-1 items-center gap-4 overflow-hidden">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 text-sky-600 shadow-inner dark:from-sky-900/50 dark:to-blue-900/50 dark:text-sky-400">
          <FileIcon className="h-6 w-6" />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {isEditing ? (
            <div className="space-y-4 pr-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full max-w-[300px] rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all duration-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancel();
                  }}
                />
                <Button
                  variant="ghost"
                  onClick={handleSave}
                  className="!p-2 border-none text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 bg-transparent dark:bg-transparent shadow-none"
                  title="Save"
                >
                  <Check className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className="!p-2 border-none text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 bg-transparent dark:bg-transparent shadow-none"
                  title="Cancel"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {editTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="rounded-full p-0.5 hover:bg-sky-200 dark:hover:bg-sky-800 transition"
                      title={`Remove tag ${tag}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                      <TagIcon className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                        if (e.key === 'Escape') handleCancel();
                      }}
                      placeholder="Add tag..."
                      className="w-36 rounded-xl border-2 border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 outline-none transition-all duration-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    onClick={handleAddTag}
                    className="!px-3 !py-1.5 border-none text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-900/20 bg-transparent dark:bg-transparent shadow-none"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <span
                className="truncate text-base font-bold text-slate-800 dark:text-slate-100"
                title={fileInfo.customName}
              >
                {fileInfo.customName}
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                {formatBytes(fileInfo.size)}
              </span>
              {fileInfo.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {fileInfo.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-4">
        {!isEditing && (
          <Button
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="!p-2.5 border-none text-slate-400 transition-all duration-200 hover:bg-sky-50 hover:text-sky-600 dark:text-slate-500 dark:hover:bg-sky-900/20 dark:hover:text-sky-400 bg-transparent dark:bg-transparent shadow-none"
            title="Rename"
          >
            <Edit2 className="h-5 w-5" />
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => onRemove(fileInfo.id)}
          className="!p-2.5 border-none text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 bg-transparent dark:bg-transparent shadow-none"
          title="Remove"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
