import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import Toggle from '@/components/bits/Toggle';
import ErasureCodingSection, {
  type ErasureCodingConfig,
} from '@/components/items/ErasureCodingSection';

// ---------- Types ----------

type ProviderType = 'aws' | 'azure' | 'gcp';

interface AWSFields {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
}

interface AzureFields {
  storageAccountName: string;
  storageAccountKey: string;
  containerName: string;
}

interface GCPFields {
  serviceAccountJson: string;
  bucketName: string;
}

interface StorageProvider {
  id: string;
  type: ProviderType;
  fields: AWSFields | AzureFields | GCPFields;
  collapsed: boolean;
}

type TabId = 'custom' | 'ayo';

// ---------- Helpers ----------

const GCP_REQUIRED_KEYS = [
  'type',
  'project_id',
  'private_key_id',
  'private_key',
  'client_email',
  'client_id',
] as const;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyFields(type: ProviderType): AWSFields | AzureFields | GCPFields {
  switch (type) {
    case 'aws':
      return { accessKeyId: '', secretAccessKey: '', region: '', bucketName: '' };
    case 'azure':
      return { storageAccountName: '', storageAccountKey: '', containerName: '' };
    case 'gcp':
      return { serviceAccountJson: '', bucketName: '' };
  }
}

function providerLabel(type: ProviderType) {
  return type === 'aws' ? 'AWS S3' : type === 'azure' ? 'Azure Blob' : 'Google Cloud';
}

function getBucketOrContainer(p: StorageProvider): string {
  if (p.type === 'aws') return (p.fields as AWSFields).bucketName.trim().toLowerCase();
  if (p.type === 'azure') return (p.fields as AzureFields).containerName.trim().toLowerCase();
  return (p.fields as GCPFields).bucketName.trim().toLowerCase();
}

// ---------- Sub-components ----------

function ProviderForm({
  provider,
  onChange,
  onRemove,
  onToggleCollapse,
  errors,
}: {
  provider: StorageProvider;
  onChange: (id: string, fields: StorageProvider['fields']) => void;
  onRemove: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  errors: Record<string, string>;
}) {
  const update = (key: string, value: string) => {
    onChange(provider.id, { ...provider.fields, [key]: value });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white transition dark:border-slate-700 dark:bg-slate-800/60">
      {/* Header */}
      <button
        type="button"
        onClick={() => onToggleCollapse(provider.id)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-500">
            {providerLabel(provider.type)}
          </span>
          {!provider.collapsed && (
            <span className="text-xs text-slate-400">
              {provider.type === 'aws'
                ? (provider.fields as AWSFields).bucketName || 'Untitled'
                : provider.type === 'azure'
                  ? (provider.fields as AzureFields).containerName || 'Untitled'
                  : (provider.fields as GCPFields).bucketName || 'Untitled'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ChevronDown
            className="h-3.5 w-3.5 text-slate-400 transition-transform"
            style={{ transform: provider.collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
        </div>
      </button>

      {/* Body */}
      {!provider.collapsed && (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-700">
          {provider.type === 'aws' && (
            <>
              <TextInput
                id={`${provider.id}-access-key`}
                label="Access Key ID"
                placeholder="AKIA..."
                value={(provider.fields as AWSFields).accessKeyId}
                onChange={(e) => update('accessKeyId', e.target.value)}
                error={errors.accessKeyId}
              />
              <TextInput
                id={`${provider.id}-secret-key`}
                label="Secret Access Key"
                type="password"
                placeholder="Enter secret key"
                value={(provider.fields as AWSFields).secretAccessKey}
                onChange={(e) => update('secretAccessKey', e.target.value)}
                error={errors.secretAccessKey}
              />
              <TextInput
                id={`${provider.id}-region`}
                label="Region"
                placeholder="us-east-1"
                value={(provider.fields as AWSFields).region}
                onChange={(e) => update('region', e.target.value)}
                error={errors.region}
              />
              <TextInput
                id={`${provider.id}-bucket`}
                label="Bucket Name"
                placeholder="my-bucket"
                value={(provider.fields as AWSFields).bucketName}
                onChange={(e) => update('bucketName', e.target.value)}
                error={errors.bucketName}
              />
            </>
          )}

          {provider.type === 'azure' && (
            <>
              <TextInput
                id={`${provider.id}-account-name`}
                label="Storage Account Name"
                placeholder="myaccountname"
                value={(provider.fields as AzureFields).storageAccountName}
                onChange={(e) => update('storageAccountName', e.target.value)}
                error={errors.storageAccountName}
              />
              <TextInput
                id={`${provider.id}-account-key`}
                label="Storage Account Key"
                type="password"
                placeholder="Enter account key"
                value={(provider.fields as AzureFields).storageAccountKey}
                onChange={(e) => update('storageAccountKey', e.target.value)}
                error={errors.storageAccountKey}
              />
              <TextInput
                id={`${provider.id}-container`}
                label="Container Name"
                placeholder="my-container"
                value={(provider.fields as AzureFields).containerName}
                onChange={(e) => update('containerName', e.target.value)}
                error={errors.containerName}
              />
            </>
          )}

          {provider.type === 'gcp' && (
            <>
              <div className="space-y-1">
                <label
                  htmlFor={`${provider.id}-sa-json`}
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Service Account JSON
                </label>
                <textarea
                  id={`${provider.id}-sa-json`}
                  rows={6}
                  placeholder='{"type": "service_account", ...}'
                  value={(provider.fields as GCPFields).serviceAccountJson}
                  onChange={(e) => update('serviceAccountJson', e.target.value)}
                  className={`w-full rounded-lg border ${errors.serviceAccountJson ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'} bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:ring-2 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100 font-mono`}
                />
                {errors.serviceAccountJson && (
                  <p className="text-xs text-red-500 dark:text-red-400">
                    {errors.serviceAccountJson}
                  </p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Must contain: type, project_id, private_key_id, private_key, client_email,
                  client_id
                </p>
              </div>
              <TextInput
                id={`${provider.id}-gcp-bucket`}
                label="Bucket Name"
                placeholder="my-gcs-bucket"
                value={(provider.fields as GCPFields).bucketName}
                onChange={(e) => update('bucketName', e.target.value)}
                error={errors.bucketName}
              />
            </>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onRemove(provider.id)}
              className="text-xs font-medium text-red-500 transition hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            >
              Remove Provider
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Main ----------

export default function StorageSettings() {
  const [activeTab, setActiveTab] = useState<TabId>('custom');

  // Custom storage state
  const [customEnabled, setCustomEnabled] = useState(false);
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [providerErrors, setProviderErrors] = useState<Record<string, Record<string, string>>>({});
  const [customErasureEnabled, setCustomErasureEnabled] = useState(false);
  const [customErasureConfig, setCustomErasureConfig] = useState<ErasureCodingConfig>('2+2');

  // Ayo storage state
  const [ayoEnabled, setAyoEnabled] = useState(false);
  const [ayoErasureEnabled, setAyoErasureEnabled] = useState(false);
  const [ayoErasureConfig, setAyoErasureConfig] = useState<ErasureCodingConfig>('2+2');

  // -- Provider CRUD --

  const addProvider = (type: ProviderType) => {
    const newProvider: StorageProvider = {
      id: generateId(),
      type,
      fields: emptyFields(type),
      collapsed: false,
    };
    setProviders((prev) => [...prev, newProvider]);
  };

  const updateProviderFields = (id: string, fields: StorageProvider['fields']) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, fields } : p)));
    // Clear errors for this provider as user types
    setProviderErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const removeProvider = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
    setProviderErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleCollapse = (id: string) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, collapsed: !p.collapsed } : p)));
  };

  // -- Validation --

  const validateProviders = useCallback((): boolean => {
    const newErrors: Record<string, Record<string, string>> = {};
    let valid = true;

    for (const p of providers) {
      const errs: Record<string, string> = {};

      if (p.type === 'aws') {
        const f = p.fields as AWSFields;
        if (!f.accessKeyId.trim()) errs.accessKeyId = 'Access Key ID is required';
        if (!f.secretAccessKey.trim()) errs.secretAccessKey = 'Secret Access Key is required';
        if (!f.region.trim()) errs.region = 'Region is required';
        if (!f.bucketName.trim()) errs.bucketName = 'Bucket Name is required';
      } else if (p.type === 'azure') {
        const f = p.fields as AzureFields;
        if (!f.storageAccountName.trim()) errs.storageAccountName = 'Account Name is required';
        if (!f.storageAccountKey.trim()) errs.storageAccountKey = 'Account Key is required';
        if (!f.containerName.trim()) errs.containerName = 'Container Name is required';
      } else {
        const f = p.fields as GCPFields;
        if (!f.serviceAccountJson.trim()) {
          errs.serviceAccountJson = 'Service Account JSON is required';
        } else {
          try {
            const parsed = JSON.parse(f.serviceAccountJson);
            const missingKeys = GCP_REQUIRED_KEYS.filter((k) => !(k in parsed) || !parsed[k]);
            if (missingKeys.length > 0) {
              errs.serviceAccountJson = `Missing required fields: ${missingKeys.join(', ')}`;
            }
          } catch {
            errs.serviceAccountJson = 'Invalid JSON format';
          }
        }
        if (!f.bucketName.trim()) errs.bucketName = 'Bucket Name is required';
      }

      if (Object.keys(errs).length > 0) {
        newErrors[p.id] = errs;
        valid = false;
      }
    }

    // Duplicate bucket/container check
    const seen = new Map<string, string>();
    for (const p of providers) {
      const key = `${p.type}::${getBucketOrContainer(p)}`;
      if (!getBucketOrContainer(p)) continue;
      if (seen.has(key)) {
        const label = p.type === 'azure' ? 'containerName' : 'bucketName';
        if (!newErrors[p.id]) newErrors[p.id] = {};
        newErrors[p.id][label] =
          `Duplicate: another ${providerLabel(p.type)} provider already uses this ${p.type === 'azure' ? 'container' : 'bucket'}`;
        valid = false;
        // Also mark the original
        const origId = seen.get(key)!;
        if (!newErrors[origId]) newErrors[origId] = {};
        newErrors[origId][label] =
          `Duplicate: another ${providerLabel(p.type)} provider already uses this ${p.type === 'azure' ? 'container' : 'bucket'}`;
      } else {
        seen.set(key, p.id);
      }
    }

    setProviderErrors(newErrors);
    return valid;
  }, [providers]);

  const handleSaveCustom = () => {
    if (!validateProviders()) {
      toast.error('Please fix the validation errors before saving.');
      // Expand any providers with errors
      setProviders((prev) =>
        prev.map((p) => (providerErrors[p.id] ? { ...p, collapsed: false } : p))
      );
      return;
    }
    toast.success('Storage settings saved! (UI only — no backend)');
  };

  const handleSaveAyo = () => {
    toast.success('Ayo storage settings saved! (UI only — no backend)');
  };

  // -- Tab classes --
  const tabClass = (id: TabId) =>
    `px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
      activeTab === id
        ? 'border-sky-500 text-sky-600 dark:text-sky-400'
        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Storage Settings
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Configure where your files are stored and how they are protected.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button type="button" className={tabClass('custom')} onClick={() => setActiveTab('custom')}>
          Custom Storage (Recommended)
        </button>
        <button type="button" className={tabClass('ayo')} onClick={() => setActiveTab('ayo')}>
          Ayo Provided Storage
        </button>
      </div>

      {/* Custom Storage Tab */}
      {activeTab === 'custom' && (
        <div className="space-y-5">
          <Toggle
            id="custom-storage-toggle"
            label="Enable Custom Storage"
            description="Use your own cloud storage for maximum security and cost control."
            checked={customEnabled}
            onChange={(e) => setCustomEnabled(e.target.checked)}
          />

          <div
            className={`space-y-5 transition-opacity ${customEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'}`}
          >
            {/* Provider list */}
            <div className="space-y-3">
              {providers.map((p) => (
                <ProviderForm
                  key={p.id}
                  provider={p}
                  onChange={updateProviderFields}
                  onRemove={removeProvider}
                  onToggleCollapse={toggleCollapse}
                  errors={providerErrors[p.id] || {}}
                />
              ))}
            </div>

            {/* Add provider */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Add storage provider:
              </span>
              {(['aws', 'gcp', 'azure'] as ProviderType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addProvider(type)}
                  disabled={!customEnabled}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + {providerLabel(type)}
                </button>
              ))}
            </div>

            {/* Erasure Coding */}
            <ErasureCodingSection
              enabled={customErasureEnabled}
              onToggle={setCustomErasureEnabled}
              selectedConfig={customErasureConfig}
              onConfigChange={setCustomErasureConfig}
              disabled={!customEnabled}
            />

            {/* Save */}
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleSaveCustom}
                disabled={!customEnabled}
                className="text-sm"
              >
                Save Custom Storage Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ayo Provided Storage Tab */}
      {activeTab === 'ayo' && (
        <div className="space-y-5">
          {/* Warning */}
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-900/20">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Custom storage is more secure and cheaper
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Use Ayo Provided Storage only if you want to avoid the technical difficulties of
                  setting up your own cloud storage. Your data will be stored on Ayo-managed
                  infrastructure.
                </p>
              </div>
            </div>
          </div>

          <Toggle
            id="ayo-storage-toggle"
            label="Enable Ayo Provided Storage"
            description="Let Ayo manage your storage infrastructure."
            checked={ayoEnabled}
            onChange={(e) => setAyoEnabled(e.target.checked)}
          />

          <div
            className={`space-y-5 transition-opacity ${ayoEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'}`}
          >
            <ErasureCodingSection
              enabled={ayoErasureEnabled}
              onToggle={setAyoErasureEnabled}
              selectedConfig={ayoErasureConfig}
              onConfigChange={setAyoErasureConfig}
              disabled={!ayoEnabled}
            />

            <div className="pt-2">
              <Button
                type="button"
                onClick={handleSaveAyo}
                disabled={!ayoEnabled}
                className="text-sm"
              >
                Save Ayo Storage Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
