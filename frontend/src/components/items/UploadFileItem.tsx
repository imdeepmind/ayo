import { Check, Edit2, File as FileIcon, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { useState } from 'react';

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
    <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-1 items-center gap-4 overflow-hidden">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">
          <FileIcon className="h-6 w-6" />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {isEditing ? (
            <div className="space-y-3 pr-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full max-w-[300px] rounded-xl border border-border-input bg-surface-alt px-3 py-1.5 text-sm font-medium text-text outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancel();
                  }}
                />
                <Button
                  variant="ghost"
                  onClick={handleSave}
                  className="!p-2 border-none text-emerald-500 hover:bg-emerald-500/10 bg-transparent shadow-none"
                  title="Save"
                >
                  <Check className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className="!p-2 border-none text-text-subtle hover:bg-surface-hover bg-transparent shadow-none"
                  title="Cancel"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {editTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="rounded-full p-0.5 hover:bg-primary/20 transition"
                      title={`Remove tag ${tag}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                      <TagIcon className="h-3.5 w-3.5 text-text-faint" />
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
                      className="w-36 rounded-xl border border-border-input bg-surface-alt py-1 pl-8 pr-3 text-xs font-medium text-text outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-text-faint"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    onClick={handleAddTag}
                    className="!px-3 !py-1 border-none text-xs font-semibold text-primary hover:bg-primary/10 bg-transparent shadow-none"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <span className="truncate text-base font-bold text-text" title={fileInfo.customName}>
                {fileInfo.customName}
              </span>
              <span className="text-xs text-text-muted mt-0.5">{formatBytes(fileInfo.size)}</span>
              {fileInfo.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {fileInfo.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
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

      <div className="flex shrink-0 items-center gap-1 pl-4">
        {!isEditing && (
          <Button
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="!p-2 border-none text-text-muted transition-all duration-200 hover:bg-primary/10 hover:text-primary bg-transparent shadow-none"
            title="Rename"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => onRemove(fileInfo.id)}
          className="!p-2 border-none text-text-muted transition-all duration-200 hover:bg-primary/10 hover:text-primary bg-transparent shadow-none"
          title="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
