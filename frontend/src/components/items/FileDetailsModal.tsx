import { Folder, HardDrive, Layers, Tags as TagIcon, X } from 'lucide-react';

import type { FileItem } from '@/lib/files';
import { formatSize, getFileTypeChip, tagChipClass } from '@/lib/files';

import Modal from '@/components/bits/Modal';

import awsLogo from '@/assets/images/providers/aws.svg';
import azureLogo from '@/assets/images/providers/azure.svg';
import gcpLogo from '@/assets/images/providers/gcp.svg';

import type { home } from '../../../wailsjs/go/models';

type FileDetailsModalProps = {
  isOpen: boolean;
  file: FileItem | null;
  details: home.FileDetails | null;
  onClose: () => void;
};

type ProviderLogo = { logo: string };

const providerLogos: Record<string, ProviderLogo | { icon: React.ReactNode }> = {
  aws: { logo: awsLogo },
  azure: { logo: azureLogo },
  gcp: { logo: gcpLogo },
  local: { icon: <Folder className="h-3.5 w-3.5 text-slate-500" /> },
};

function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="shrink-0 text-sm font-medium text-text-muted dark:text-text-subtle">
        {label}
      </span>
      <span className="min-w-0 text-right text-sm font-semibold text-text truncate">{value}</span>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-faint">
      {icon}
      {children}
    </div>
  );
}

export default function FileDetailsModal({
  isOpen,
  file,
  details,
  onClose,
}: FileDetailsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      {file && (
        <>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-text">File Details</h2>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-text-faint hover:bg-surface-alt hover:text-text-muted transition dark:hover:bg-surface-hover dark:hover:text-text"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!details ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-border-strong border-t-primary dark:border-border-strong dark:border-t-primary" />
              <span className="text-sm font-medium text-text-subtle">Loading file details...</span>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="divide-y divide-border dark:divide-border-strong">
                <InfoRow label="Original File Name" value={details.OriginalName || '—'} />
                <InfoRow label="Custom Name" value={details.CustomName || '—'} />
                <InfoRow
                  label="Type"
                  value={
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getFileTypeChip(file.name, file.type).chip}`}
                    >
                      {getFileTypeChip(file.name, file.type).label}
                    </span>
                  }
                />
                <InfoRow label="Size" value={formatSize(details.Size)} />
                <InfoRow
                  label="Stored Size (with erasure)"
                  value={formatSize(details.StoredSize)}
                />
                <InfoRow
                  label="Data Shards"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-text-faint" />
                      {details.DataShards}
                    </span>
                  }
                />
                <InfoRow
                  label="Parity Shards"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-text-faint" />
                      {details.ParityShards}
                    </span>
                  }
                />
                <InfoRow label="Created" value={formatTimestamp(details.CreatedAt)} />
                <InfoRow label="Last Modified" value={formatTimestamp(details.UpdatedAt)} />
              </div>

              <div className="space-y-3">
                <SectionTitle icon={<TagIcon className="h-3.5 w-3.5" />}>Tags</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {details.Tags.length === 0 ? (
                    <span className="text-xs text-text-faint italic">No tags added</span>
                  ) : (
                    details.Tags.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tagChipClass}`}
                      >
                        {tag}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <SectionTitle icon={<HardDrive className="h-3.5 w-3.5" />}>
                  Storage Providers
                </SectionTitle>
                {details.Providers.length === 0 ? (
                  <span className="text-xs text-text-faint italic">No providers found</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {details.Providers.map((provider) => {
                      const logo = providerLogos[provider.Type];
                      return (
                        <span
                          key={provider.ID}
                          title={provider.ID}
                          className="inline-flex items-center gap-2 rounded-full border border-border dark:border-border-strong bg-surface-alt/50 dark:bg-surface-alt px-2 py-1"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                            {logo && 'logo' in logo ? (
                              <img
                                src={logo.logo}
                                alt={provider.Name}
                                className="h-4 w-4"
                                draggable={false}
                              />
                            ) : logo && 'icon' in logo ? (
                              logo.icon
                            ) : null}
                          </span>
                          <span className="text-xs font-semibold text-text">
                            {provider.Name}
                            {provider.Resource ? (
                              <span className="text-text-muted dark:text-text-subtle">
                                {' '}
                                · {provider.Resource}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
