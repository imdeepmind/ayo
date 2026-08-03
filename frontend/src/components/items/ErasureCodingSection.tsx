import Toggle from '@/components/bits/Toggle';

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
      <div className="rounded-2xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800/90">
        <Toggle
          id="erasure-coding-toggle"
          label="Erasure Coding"
          description="Split data into fragments with parity for fault tolerance. Protects against shard loss with minimal storage overhead."
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={disabled}
        />
      </div>

      {enabled && !disabled && (
        <div className="space-y-4 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 dark:border-slate-700 dark:from-slate-900/50 dark:to-blue-950/20">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
            Choose how data is split into data shards + parity shards. Higher parity means more
            fault tolerance but more storage overhead.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {configs.map((c) => (
              <label
                key={c.value}
                className={`group relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200
                  ${
                    selectedConfig === c.value
                      ? 'border-sky-500 bg-gradient-to-br from-sky-50 to-blue-50 shadow-lg dark:border-sky-400 dark:from-sky-950/40 dark:to-blue-950/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-slate-600'
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
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {c.label}
                  </span>
                  <span
                    className={`h-5 w-5 rounded-full border-2 transition-all duration-200 ${
                      selectedConfig === c.value
                        ? 'border-sky-500 bg-sky-500 shadow-sm'
                        : 'border-slate-300 dark:border-slate-600'
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
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium">
                      {c.data} data + {c.parity} parity
                    </span>
                    <span>{c.totalShards} shards total</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                    <span>Can lose {c.faultTolerance} shards</span>
                    <span className="font-semibold text-sky-600 dark:text-sky-400">
                      Overhead: {c.overhead}
                    </span>
                  </div>
                  {c.note && (
                    <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400 leading-relaxed">
                      {c.note}
                    </p>
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
