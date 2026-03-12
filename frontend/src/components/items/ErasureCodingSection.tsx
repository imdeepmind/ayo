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
        <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
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
                <div className="space-y-3 pl-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Choose how data is split into data shards + parity shards. Higher parity means more
                        fault tolerance but more storage overhead.
                    </p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {configs.map((c) => (
                            <label
                                key={c.value}
                                className={`group relative cursor-pointer rounded-xl border-2 p-4 transition
                  ${selectedConfig === c.value
                                        ? 'border-sky-500 bg-sky-50/50 shadow-sm dark:border-sky-400 dark:bg-sky-900/10'
                                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600'
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
                                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {c.label}
                                    </span>
                                    <span
                                        className={`h-4 w-4 rounded-full border-2 transition ${selectedConfig === c.value
                                            ? 'border-sky-500 bg-sky-500'
                                            : 'border-slate-300 dark:border-slate-600'
                                            }`}
                                    >
                                        {selectedConfig === c.value && (
                                            <span className="flex h-full w-full items-center justify-center">
                                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                            </span>
                                        )}
                                    </span>
                                </div>

                                <div className="mt-2 space-y-1">
                                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                                        <span>
                                            {c.data} data + {c.parity} parity
                                        </span>
                                        <span>{c.totalShards} shards total</span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                                        <span>Can lose {c.faultTolerance} shards</span>
                                        <span>Overhead: {c.overhead}</span>
                                    </div>
                                    {c.note && (
                                        <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">
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
