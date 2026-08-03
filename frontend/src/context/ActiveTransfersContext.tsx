import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import {
  FinalizeDownload,
  GetActiveTransfers,
  GetStorageUsed,
} from '../../wailsjs/go/upload/Service';
import { upload } from '../../wailsjs/go/models';
import { useAuth } from '@/context/AuthContext';

const REFRESH_MS = 2000;

export type ActiveTransfer = upload.EnqueuedJob;

export type ActiveTransfers = {
  transfers: ActiveTransfer[];
  uploads: ActiveTransfer[];
  downloads: ActiveTransfer[];
  deletes: ActiveTransfer[];
  completedDownloads: ActiveTransfer[];
  overallProgress: number | null;
  storageUsed: number;
  refresh: () => Promise<void>;
};

const ActiveTransfersContext = createContext<ActiveTransfers | null>(null);

// ActiveTransfersProvider owns the single poll for in-flight transfers and
// storage usage so every page (and the global status bar) shares one data
// source instead of each calling the backend itself. When a download
// completes, it triggers FinalizeDownload once so the native save dialog
// appears. It only polls while a session exists; on auth pages the context
// holds empty defaults.
export function ActiveTransfersProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [transfers, setTransfers] = useState<ActiveTransfer[]>([]);
  const [overallProgress, setOverallProgress] = useState<number | null>(null);
  const [storageUsed, setStorageUsed] = useState(0);
  const finalized = useRef<Set<number>>(new Set());

  const finalize = useCallback(async (job: ActiveTransfer) => {
    try {
      const savedPath = await FinalizeDownload(job.ID);
      if (savedPath) {
        toast.success(`Saved to ${savedPath}`);
      } else {
        toast('Download cancelled.');
      }
    } catch (err) {
      console.error('Failed to finalize download:', err);
      toast.error('Failed to save the download. Please try again.');
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const all = await GetActiveTransfers();
      setTransfers(all);

      const inFlight = all.filter((t) => t.Status !== 'completed');
      if (inFlight.length === 0) {
        setOverallProgress(null);
      } else {
        const sum = inFlight.reduce((acc, t) => acc + t.Progress, 0);
        setOverallProgress(Math.round(sum / inFlight.length));
      }

      const total = await GetStorageUsed();
      setStorageUsed(total);

      // Show the save dialog for newly completed downloads, once each.
      for (const job of all) {
        if (
          job.Type === 'download' &&
          job.Status === 'completed' &&
          !finalized.current.has(job.ID)
        ) {
          finalized.current.add(job.ID);
          void finalize(job);
        }
      }
    } catch (err) {
      console.error('Failed to load active transfers:', err);
    }
  }, [finalize]);

  useEffect(() => {
    if (!session) {
      setTransfers([]);
      setOverallProgress(null);
      setStorageUsed(0);
      return;
    }
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [session, load]);

  const value = useMemo<ActiveTransfers>(() => {
    const uploads = transfers.filter((t) => t.Type === 'upload');
    const downloads = transfers.filter((t) => t.Type === 'download' && t.Status !== 'completed');
    const deletes = transfers.filter((t) => t.Type === 'delete' && t.Status !== 'completed');
    const completedDownloads = transfers.filter(
      (t) => t.Type === 'download' && t.Status === 'completed'
    );

    return {
      transfers,
      uploads,
      downloads,
      deletes,
      completedDownloads,
      overallProgress,
      storageUsed,
      refresh: load,
    };
  }, [transfers, overallProgress, storageUsed, load]);

  return (
    <ActiveTransfersContext.Provider value={value}>{children}</ActiveTransfersContext.Provider>
  );
}

// useActiveTransfers reads the shared transfer state. It must be used inside
// ActiveTransfersProvider.
export function useActiveTransfers(): ActiveTransfers {
  const context = useContext(ActiveTransfersContext);
  if (!context) {
    throw new Error('useActiveTransfers must be used within ActiveTransfersProvider');
  }
  return context;
}
