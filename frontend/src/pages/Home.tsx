import { useMemo, useState } from 'react';
import { files, TOTAL_STORAGE_LIMIT_BYTES, calculateTotalUsedBytes } from '@/mock-data/files';
import DriveToolbar from '@/components/items/DriveToolbar';
import DriveFileTable from '@/components/items/DriveFileTable';
import DriveStatusBar from '@/components/items/DriveStatusBar';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return files;
    return files.filter((file) => {
      const nameMatch = file.name.toLowerCase().includes(query);
      const typeMatch = file.type.toLowerCase().includes(query);
      return nameMatch || typeMatch;
    });
  }, [searchQuery]);

  const totalUsedBytes = useMemo(() => calculateTotalUsedBytes(files), []);

  return (
    <div className="w-full">
      <div className="relative w-full pb-16">
        <div className="mx-auto w-full px-4 pt-6 md:px-8 lg:px-16">
          <DriveToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onUploadClick={() => {
              // placeholder for future upload handler
            }}
          />
          <DriveFileTable files={filteredFiles} />
        </div>

        <DriveStatusBar totalUsedBytes={totalUsedBytes} totalLimitBytes={TOTAL_STORAGE_LIMIT_BYTES} />
      </div>
    </div>
  );
}
