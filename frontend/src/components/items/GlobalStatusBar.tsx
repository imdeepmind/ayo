import { useAuth } from '@/context/AuthContext';
import { useActiveTransfers } from '@/context/ActiveTransfersContext';
import DriveStatusBar from '@/components/items/DriveStatusBar';

// GlobalStatusBar surfaces transfer progress and storage usage on every
// authenticated page (and logged-in 404s) via the shared ActiveTransfers
// provider. It renders nothing on auth pages, which never have a session.
export default function GlobalStatusBar() {
  const { session } = useAuth();
  const { uploads, downloads, deletes, overallProgress, storageUsed } = useActiveTransfers();

  if (!session) return null;

  return (
    <DriveStatusBar
      totalUsedBytes={storageUsed}
      activeUploads={uploads.length}
      activeDownloads={downloads.length}
      activeDeletes={deletes.length}
      overallProgress={overallProgress}
    />
  );
}
