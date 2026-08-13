export type FileItemType = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';

export type FileTypeChip = {
  label: string;
  chip: string;
};

const fileTypeChipMap: Record<FileItemType, FileTypeChip> = {
  image: {
    label: 'Image',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  },
  video: {
    label: 'Video',
    chip: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200',
  },
  audio: {
    label: 'Audio',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  },
  archive: {
    label: 'Folder',
    chip: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  },
  document: {
    label: 'PDF',
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200',
  },
  other: {
    label: 'PDF',
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200',
  },
};

// getFileTypeChip resolves the display label and chip color classes for a file,
// honoring the same per-name overrides used by the drive table.
export function getFileTypeChip(name: string, type: FileItemType): FileTypeChip {
  const lower = name.toLowerCase();
  const base = fileTypeChipMap[type];
  let label = base.label;
  if (lower.endsWith('.pdf')) label = 'PDF';
  else if (lower.endsWith('.jpg') || lower.endsWith('.png')) label = 'Image';
  else if (lower.endsWith('.doc') || lower.endsWith('.docx')) label = 'Folder';
  return { label, chip: base.chip };
}

// tagChipClass is the color-coded chip style used for file tags, matching the
// file type chip design.
export const tagChipClass =
  'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200';

export interface FileItem {
  id: string;
  name: string;
  type: FileItemType;
  sizeBytes: number;
  modifiedAt: string; // ISO string
  owner: string;
  tags: string[];
}

// getFileType maps a file name to its drive category based on the extension.
// Unknown or extensionless names fall back to 'other'.
export function getFileType(name: string): FileItemType {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'avif'];
  const videoExts = ['mp4', 'mov', 'mkv', 'avi', 'webm', 'flv', 'wmv', 'm4v'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (archiveExts.includes(ext)) return 'archive';
  if (
    ext === 'txt' ||
    ext === 'pdf' ||
    ext === 'doc' ||
    ext === 'docx' ||
    ext === 'xls' ||
    ext === 'xlsx' ||
    ext === 'ppt' ||
    ext === 'pptx' ||
    ext === 'md' ||
    ext === 'csv' ||
    ext === 'json'
  ) {
    return 'document';
  }
  return 'other';
}

// formatSize renders a byte count as a compact human-readable string, e.g.
// 15728640 -> "15.0MB".
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(1)}${units[index]}`;
}
