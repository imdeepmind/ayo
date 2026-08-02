export type FileItemType = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';

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

export function calculateTotalUsedBytes(items: FileItem[]): number {
  return items.reduce((total, item) => total + item.sizeBytes, 0);
}
