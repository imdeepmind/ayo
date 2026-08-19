import Toggle from '@/components/bits/Toggle';
import WarningBanner from '@/components/bits/WarningBanner';

export type ErasureCodingConfig = '2+2' | '6+3' | '10+4' | '17+3';

type ErasureCodingSectionProps = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  selectedConfig: ErasureCodingConfig;
  onConfigChange: (config: ErasureCodingConfig) => void;
  disabled?: boolean;
};

const configs: {
  value: ErasureCodingConfig;
  label: string;
  data: number;
  parity: number;
  totalShards: number;
  faultTolerance: number;
  overhead: string;
  note?: string;
}[] = [
  {
    value: '2+2',
    label: 'EC:2+2',
    data: 2,
    parity: 2,
    totalShards: 4,
    faultTolerance: 2,
    overhead: '2x',
  },
  {
    value: '6+3',
    label: 'EC:6+3',
    data: 6,
    parity: 3,
    totalShards: 9,
    faultTolerance: 3,
    overhead: '1.5x',
  },
  {
    value: '10+4',
    label: 'EC:10+4',
    data: 10,
    parity: 4,
    totalShards: 14,
    faultTolerance: 4,
    overhead: '1.4x',
    note: 'Used by systems like MinIO',
  },
  {
    value: '17+3',
    label: 'EC:17+3',
    data: 17,
    parity: 3,
    totalShards: 20,
    faultTolerance: 3,
    overhead: '1.18x',
    note: 'Very storage-efficient, less redundancy. Used by Backblaze Vaults',
  },
];

export default function ErasureCodingSection({
  enabled,
  onToggle,
  selectedConfig,
  onConfigChange,
  disabled = false,
}: ErasureCodingSectionProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface backdrop-blur-sm p-6 dark:border-border-strong">
        <Toggle
          id="erasure-coding-toggle"
          label="Erasure Coding"
          description="Split data into fragments with parity for fault tolerance. Protects against shard loss with minimal storage overhead."
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={disabled}
        />
      </div>

      {!enabled && !disabled && (
        <WarningBanner
          title="Data loss risk without erasure coding"
          description="With erasure coding disabled, each file is stored as a single copy on one provider. If that copy is lost or corrupted, your data cannot be recovered."
        />
      )}

      {enabled && !disabled && (
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 dark:border-border-strong">
          <p className="text-sm font-medium text-text-muted dark:text-text leading-relaxed">
            Choose how data is split into data shards + parity shards. Higher parity means more
            fault tolerance but more storage overhead.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {configs.map((c) => (
              <label
                key={c.value}
                className={`group relative cursor-pointer rounded-2xl border p-5 transition-all duration-200
                  ${
                    selectedConfig === c.value
                      ? 'border-primary bg-primary/10 dark:border-primary/40 dark:bg-primary/20'
                      : 'border-border bg-surface-alt hover:border-border-strong dark:border-border-strong dark:bg-surface-alt dark:hover:border-border-input'
                  }
                `}
              >
                <input
                  type="radio"
                  name="erasure-coding-config"
                  value={c.value}
                  checked={selectedConfig === c.value}
                  onChange={() => onConfigChange(c.value)}
                  className="sr-only"
                />

                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-text">{c.label}</span>
                  <span
                    className={`h-5 w-5 rounded-full border-2 transition-all duration-200 ${
                      selectedConfig === c.value
                        ? 'border-primary bg-primary shadow-sm'
                        : 'border-border-strong dark:border-border-input'
                    }`}
                  >
                    {selectedConfig === c.value && (
                      <span className="flex h-full w-full items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-white" />
                      </span>
                    )}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
                    <span className="font-medium">
                      {c.data} data + {c.parity} parity
                    </span>
                    <span>{c.totalShards} shards total</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
                    <span>Can lose {c.faultTolerance} shards</span>
                    <span className="font-semibold text-primary">Overhead: {c.overhead}</span>
                  </div>
                  {c.note && (
                    <p className="mt-2 text-xs italic text-text-subtle leading-relaxed">{c.note}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
