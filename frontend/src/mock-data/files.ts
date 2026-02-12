export type FileItemType = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';

export interface FileItem {
  id: string;
  name: string;
  type: FileItemType;
  sizeBytes: number;
  modifiedAt: string; // ISO string for now; can be Date when wired to API
  owner: string;
}

export const TOTAL_STORAGE_LIMIT_BYTES = 15 * 1024 * 1024 * 1024; // 15 GB

export const files: FileItem[] = [
  {
    id: '1',
    name: 'Product Roadmap Q1.pdf',
    type: 'document',
    sizeBytes: 1_024_000,
    modifiedAt: '2025-12-10T09:30:00.000Z',
    owner: 'You',
  },
  {
    id: '2',
    name: 'Team Photo.png',
    type: 'image',
    sizeBytes: 4_800_000,
    modifiedAt: '2025-11-03T14:12:00.000Z',
    owner: 'You',
  },
  {
    id: '3',
    name: 'Marketing_Reel.mp4',
    type: 'video',
    sizeBytes: 120_000_000,
    modifiedAt: '2025-10-21T18:45:00.000Z',
    owner: 'Design',
  },
  {
    id: '4',
    name: 'Onboarding_Notes.txt',
    type: 'document',
    sizeBytes: 32_000,
    modifiedAt: '2025-09-15T08:05:00.000Z',
    owner: 'HR',
  },
  {
    id: '5',
    name: 'System_Backup_2025-12-01.zip',
    type: 'archive',
    sizeBytes: 2_048_000_000,
    modifiedAt: '2025-12-01T02:00:00.000Z',
    owner: 'System',
  },
  {
    id: '6',
    name: 'Podcast_Episode_01.mp3',
    type: 'audio',
    sizeBytes: 58_000_000,
    modifiedAt: '2025-08-02T16:20:00.000Z',
    owner: 'You',
  },
];

export function calculateTotalUsedBytes(items: FileItem[]): number {
  return items.reduce((total, item) => total + item.sizeBytes, 0);
}

