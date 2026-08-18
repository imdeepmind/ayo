import { NavLink } from 'react-router-dom';
import {
  HardDrive,
  Upload,
  Settings,
  Loader2,
  Cloud,
  Database,
  Layers,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useActiveTransfers } from '@/context/ActiveTransfersContext';
import { useSearch } from '@/context/SearchContext';

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

// Max per-file upload rows shown before collapsing into overflow label
const maxVisibleUploads = 3;

export default function Sidebar() {
  const { session } = useAuth();
  const { uploads, downloads, deletes, overallProgress } = useActiveTransfers();
  const { clear: clearSearch } = useSearch();

  const hasTransfers = uploads.length > 0 || downloads.length > 0 || deletes.length > 0;
  const progress = overallProgress ?? 0;

  const statusParts: string[] = [];
  if (uploads.length > 0) statusParts.push(`Uploading ${plural(uploads.length, 'file')}`);
  if (downloads.length > 0) statusParts.push(`Downloading ${plural(downloads.length, 'file')}`);
  if (deletes.length > 0) statusParts.push(`Deleting ${plural(deletes.length, 'file')}`);

  const visibleUploads = uploads.slice(0, maxVisibleUploads);
  const hiddenUploads = uploads.length - visibleUploads.length;

  if (!session) return null;

  const navClass = (isActive: boolean) =>
    `w-full flex items-center gap-3 py-2.5 px-4 text-sm font-bold transition-all ${
      isActive
        ? 'text-sidebar-text bg-red-500/30 rounded-r-[64px]'
        : 'text-sidebar-muted hover:text-sidebar-text'
    }`;

  const groupLabel =
    'flex items-center gap-3 px-4 pt-4 text-xs font-bold uppercase tracking-wider text-sidebar-muted';

  return (
    <aside className="w-16 min-w-[15rem] h-full bg-gradient-to-b from-sidebar-bg to-sidebar-bg-dark text-sidebar-text rounded-tr-[64px] p-6 flex flex-col justify-between shrink-0 overflow-y-auto hidden md:flex my-0 ml-0 mb-0">
      <div className="flex flex-col gap-2 mt-4">
        <NavLink to="/" onClick={clearSearch} className={({ isActive }) => navClass(isActive)}>
          <HardDrive className="h-4 w-4 shrink-0" />
          <span>My Drive</span>
        </NavLink>

        <NavLink to="/upload" className={({ isActive }) => navClass(isActive)}>
          <Upload className="h-4 w-4 shrink-0" />
          <span>Upload Files</span>
        </NavLink>

        <p className={groupLabel}>
          <span>Storage</span>
        </p>
        <NavLink to="/storage/providers" className={({ isActive }) => navClass(isActive)}>
          <Cloud className="h-3.5 w-3.5 shrink-0" />
          <span>Providers</span>
        </NavLink>
        <NavLink to="/storage/database" className={({ isActive }) => navClass(isActive)}>
          <Database className="h-3.5 w-3.5 shrink-0" />
          <span>Database</span>
        </NavLink>
        <NavLink to="/storage/erasure-coding" className={({ isActive }) => navClass(isActive)}>
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span>Erasure Coding</span>
        </NavLink>

        <p className={groupLabel}>
          <span>Security</span>
        </p>
        <NavLink to="/security/key-management" className={({ isActive }) => navClass(isActive)}>
          <KeyRound className="h-3.5 w-3.5 shrink-0" />
          <span>Key Management</span>
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => navClass(isActive)}>
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </NavLink>
      </div>

      {/* Active transfers panel — shown only when something is in-flight */}
      {hasTransfers && (
        <div className="pt-4 flex flex-col gap-3">
          {/* Status label + spinner */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sidebar-muted" />
              <span className="text-xs font-medium text-sidebar-muted truncate">
                {statusParts.join(' · ')}
              </span>
            </div>
            <span className="text-xs font-medium text-sidebar-muted tabular-nums shrink-0">
              {progress}%
            </span>
          </div>

          {/* Overall progress bar */}
          <div className="h-2 w-full bg-sidebar-track rounded-full overflow-hidden">
            <div
              className="h-full bg-sidebar-fill rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Per-file upload rows */}
          {visibleUploads.length > 0 && (
            <div className="flex flex-col gap-1">
              {visibleUploads.map((item) => (
                <div key={item.File} className="flex items-center justify-between gap-2">
                  <span
                    className="flex-1 min-w-0 text-xs font-medium text-sidebar-muted truncate"
                    title={item.CustomName || item.File}
                  >
                    {item.CustomName || item.File}
                  </span>
                  <span className="text-xs font-medium text-sidebar-muted tabular-nums shrink-0">
                    {item.Progress}%
                  </span>
                </div>
              ))}
              {hiddenUploads > 0 && (
                <span className="text-xs font-medium text-sidebar-muted">
                  +{hiddenUploads} more
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
