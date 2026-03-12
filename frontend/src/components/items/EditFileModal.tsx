import { useState, useEffect } from 'react';
import { X, Tag as TagIcon } from 'lucide-react';
import type { FileItem } from '@/mock-data/files';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';

type EditFileModalProps = {
    isOpen: boolean;
    file: FileItem | null;
    onClose: () => void;
    onSave: (id: string, newName: string, newTags: string[]) => void;
};

export default function EditFileModal({ isOpen, file, onClose, onSave }: EditFileModalProps) {
    const [name, setName] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        if (file) {
            setName(file.name);
            setTags([...file.tags]);
        } else {
            setName('');
            setTags([]);
        }
    }, [file]);

    if (!isOpen || !file) return null;

    const handleAddTag = () => {
        const trimmed = newTag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
        }
        setNewTag('');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter((t) => t !== tagToRemove));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave(file.id, name.trim(), tags);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Edit File
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <TextInput
                        id="edit-filename"
                        label="File Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter file name"
                        required
                    />

                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                            Tags
                        </label>

                        <div className="flex flex-wrap gap-2">
                            {tags.length === 0 && (
                                <span className="text-xs text-slate-400 dark:text-slate-500 italic">No tags added</span>
                            )}
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 rounded-full bg-sky-100 py-1 pl-2.5 pr-1 text-xs font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                                >
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTag(tag)}
                                        className="rounded-full p-0.5 hover:bg-sky-200 dark:hover:bg-sky-800 transition"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
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
                                    }}
                                    placeholder="Add a tag..."
                                    className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100 placeholder:text-slate-400"
                                />
                            </div>
                            <Button type="button" variant="ghost" onClick={handleAddTag} className="px-3">
                                Add
                            </Button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            Save Changes
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
