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
  GetJobStatus,
} from '../../wailsjs/go/upload/Service';
import { GetStorageUsed } from '../../wailsjs/go/home/Service';
import { upload } from '../../wailsjs/go/models';
import { useAuth } from '@/context/AuthContext';

const REFRESH_MS = 2000;

export type ActiveTransfer = upload.EnqueuedJob;

type TrackedMeta = {
  type: string;
  name: string;
};

export type ActiveTransfers = {
  transfers: ActiveTransfer[];
  uploads: ActiveTransfer[];
  downloads: ActiveTransfer[];
  deletes: ActiveTransfer[];
  overallProgress: number | null;
  storageUsed: number;
  deleteCompletedCount: number;
  refresh: () => Promise<void>;
  trackJobs: (jobs: ActiveTransfer[]) => void;
};

const ActiveTransfersContext = createContext<ActiveTransfers | null>(null);

// ActiveTransfersProvider owns the single poll for in-flight transfers and
// storage usage so every page (and the global status bar) shares one data
// source instead of each calling the backend itself. The queue doubles as an
// append-only audit table, so finished jobs are never deleted; instead the
// provider tracks the job IDs each page submits (trackJobs) and, when one drops
// out of the active set, resolves its final status to surface success/failure
// and to trigger download finalization.
export function ActiveTransfersProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [transfers, setTransfers] = useState<ActiveTransfer[]>([]);
  const [overallProgress, setOverallProgress] = useState<number | null>(null);
  const [storageUsed, setStorageUsed] = useState(0);
  const [deleteCompletedCount, setDeleteCompletedCount] = useState(0);
  const trackedJobs = useRef<Map<number, TrackedMeta>>(new Map());

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

  const resolveCompletion = useCallback(
    async (id: number, meta: TrackedMeta) => {
      let job: ActiveTransfer;
      try {
        job = await GetJobStatus(id);
      } catch (err) {
        console.error('Failed to resolve job status:', err);
        return;
      }
      if (job.Status === 'failed') {
        toast.error(`${meta.name} failed`);
      } else       if (job.Status === 'completed') {
        if (job.Type === 'download') {
          await finalize(job);
        } else if (job.Type === 'delete') {
          toast.success(`${meta.name} deleted`);
          setDeleteCompletedCount((c) => c + 1);
        } else {
          toast.success(`${meta.name} uploaded`);
        }
      }
    },
    [finalize]
  );

  const trackJobs = useCallback((jobs: ActiveTransfer[]) => {
    jobs.forEach((job) => {
      trackedJobs.current.set(job.ID, {
        type: job.Type,
        name: job.CustomName || job.File,
      });
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const all = await GetActiveTransfers();
      setTransfers(all);

      if (all.length === 0) {
        setOverallProgress(null);
      } else {
        const sum = all.reduce((acc, t) => acc + t.Progress, 0);
        setOverallProgress(Math.round(sum / all.length));
      }

      const total = await GetStorageUsed();
      setStorageUsed(total);

      // Any tracked job that left the active set finished (or failed): resolve
      // its final status and act once.
      if (trackedJobs.current.size > 0) {
        const activeIds = new Set(all.map((t) => t.ID));
        for (const [id, meta] of trackedJobs.current) {
          if (activeIds.has(id)) continue;
          trackedJobs.current.delete(id);
          void resolveCompletion(id, meta);
        }
      }
    } catch (err) {
      console.error('Failed to load active transfers:', err);
    }
  }, [resolveCompletion]);

  useEffect(() => {
    if (!session) {
      setTransfers([]);
      setOverallProgress(null);
      setStorageUsed(0);
      trackedJobs.current.clear();
      return;
    }
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [session, load]);

  const value = useMemo<ActiveTransfers>(() => {
    const uploads = transfers.filter((t) => t.Type === 'upload');
    const downloads = transfers.filter((t) => t.Type === 'download');
    const deletes = transfers.filter((t) => t.Type === 'delete');

    return {
      transfers,
      uploads,
      downloads,
      deletes,
      overallProgress,
      storageUsed,
      deleteCompletedCount,
      refresh: load,
      trackJobs,
    };
  }, [transfers, overallProgress, storageUsed, deleteCompletedCount, load, trackJobs]);

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
