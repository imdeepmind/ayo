import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FinalizeDownload, GetActiveTransfers } from '../../wailsjs/go/upload/Service';
import { upload } from '../../wailsjs/go/models';

const REFRESH_MS = 2000;

export type ActiveTransfer = upload.EnqueuedJob;

export type ActiveTransfers = {
  transfers: ActiveTransfer[];
  uploads: ActiveTransfer[];
  downloads: ActiveTransfer[];
  deletes: ActiveTransfer[];
  completedDownloads: ActiveTransfer[];
  overallProgress: number | null;
  refresh: () => Promise<void>;
};

// useActiveTransfers polls the backend for in-flight transfers (uploads and
// downloads) so the UI can render progress. When a download completes, it
// triggers FinalizeDownload once so the native save dialog appears.
export function useActiveTransfers(): ActiveTransfers {
  const [transfers, setTransfers] = useState<ActiveTransfer[]>([]);
  const [overallProgress, setOverallProgress] = useState<number | null>(null);
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
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

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
    refresh: load,
  };
}
