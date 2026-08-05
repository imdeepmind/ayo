import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import TextInput from '@/components/bits/Input';
import Button from '@/components/bits/Button';
import Toggle from '@/components/bits/Toggle';
import ErasureCodingSection, {
  type ErasureCodingConfig,
} from '@/components/items/ErasureCodingSection';
import { GetSettings, UpdateSettings, PickFolder } from '../../../wailsjs/go/settings/Service';
import { settings } from '../../../wailsjs/go/models';

// ---------- Types ----------

type ProviderType = 'aws' | 'azure' | 'gcp' | 'local';

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

interface LocalFields {
  folderName: string;
  folderPath: string;
}

interface StorageProvider {
  id: string;
  providerId: string;
  type: ProviderType;
  fields: AWSFields | AzureFields | GCPFields | LocalFields;
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

function makeProviderId(type: ProviderType) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let random = '';
  for (const b of bytes) random += alphabet[b % alphabet.length];
  return `${type}_${random}`;
}

function emptyFields(type: ProviderType): AWSFields | AzureFields | GCPFields | LocalFields {
  switch (type) {
    case 'aws':
      return { accessKeyId: '', secretAccessKey: '', region: '', bucketName: '' };
    case 'azure':
      return { storageAccountName: '', storageAccountKey: '', containerName: '' };
    case 'gcp':
      return { serviceAccountJson: '', bucketName: '' };
    case 'local':
      return { folderName: '', folderPath: '' };
  }
}

function providerLabel(type: ProviderType) {
  return type === 'aws'
    ? 'AWS S3'
    : type === 'azure'
      ? 'Azure Blob'
      : type === 'gcp'
        ? 'Google Cloud'
        : 'Local System';
}

function getBucketOrContainer(p: StorageProvider): string {
  if (p.type === 'aws') return (p.fields as AWSFields).bucketName.trim().toLowerCase();
  if (p.type === 'azure') return (p.fields as AzureFields).containerName.trim().toLowerCase();
  if (p.type === 'gcp') return (p.fields as GCPFields).bucketName.trim().toLowerCase();
  return (p.fields as LocalFields).folderPath.trim().toLowerCase();
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
    <div className="rounded-2xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm shadow-lg transition-all duration-200 dark:border-slate-700 dark:bg-slate-800/90">
      {/* Header */}
      <button
        type="button"
        onClick={() => onToggleCollapse(provider.id)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-700/30 rounded-t-2xl transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            {providerLabel(provider.type)}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
            {provider.providerId}
          </span>
          {!provider.collapsed && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {provider.type === 'aws'
                ? (provider.fields as AWSFields).bucketName || 'Untitled'
                : provider.type === 'azure'
                  ? (provider.fields as AzureFields).containerName || 'Untitled'
                  : provider.type === 'gcp'
                    ? (provider.fields as GCPFields).bucketName || 'Untitled'
                    : (provider.fields as LocalFields).folderName || 'Untitled'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ChevronDown
            className="h-4 w-4 text-slate-400 transition-transform duration-200"
            style={{ transform: provider.collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
        </div>
      </button>

      {/* Body */}
      {!provider.collapsed && (
        <div className="space-y-4 border-t-2 border-slate-100 px-6 pb-6 pt-5 dark:border-slate-700">
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
              <div className="space-y-2">
                <label
                  htmlFor={`${provider.id}-sa-json`}
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Service Account JSON
                </label>
                <textarea
                  id={`${provider.id}-sa-json`}
                  rows={6}
                  placeholder='{"type": "service_account", ...}'
                  value={(provider.fields as GCPFields).serviceAccountJson}
                  onChange={(e) => update('serviceAccountJson', e.target.value)}
                  className={`w-full rounded-xl border-2 ${errors.serviceAccountJson ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 focus:border-sky-500 focus:ring-sky-500/20 dark:border-slate-600 dark:focus:border-sky-400'} bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition-all duration-200 focus:ring-4 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500 font-mono`}
                />
                {errors.serviceAccountJson && (
                  <p className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1.5">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {errors.serviceAccountJson}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    Must contain: type, project_id, private_key_id, private_key, client_email,
                    client_id
                  </span>
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

          {provider.type === 'local' && (
            <>
              <TextInput
                id={`${provider.id}-folder-name`}
                label="Folder Name"
                placeholder="e.g. Backups"
                value={(provider.fields as LocalFields).folderName}
                onChange={(e) => update('folderName', e.target.value)}
                error={errors.folderName}
              />
              <div className="space-y-2">
                <label
                  htmlFor={`${provider.id}-folder-path`}
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Folder Location
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`${provider.id}-folder-path`}
                    type="text"
                    readOnly
                    placeholder="Choose a folder..."
                    value={(provider.fields as LocalFields).folderPath}
                    className={`w-full flex-1 rounded-xl border-2 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm outline-none transition-all duration-200 focus:ring-4 dark:bg-slate-900/50 dark:text-slate-200 dark:placeholder:text-slate-500 ${errors.folderPath ? 'border-red-400' : 'border-slate-200 dark:border-slate-600'}`}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const path = await PickFolder();
                        if (path) update('folderPath', path);
                      } catch (err) {
                        console.error(err);
                        toast.error('Failed to open folder picker: ' + String(err));
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    Browse
                  </button>
                </div>
                {errors.folderPath && (
                  <p className="text-sm text-red-500 dark:text-red-400">{errors.folderPath}</p>
                )}
              </div>
            </>
          )}

          <div className="pt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRemove(provider.id)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-500 transition-colors hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
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

  useEffect(() => {
    GetSettings()
      .then((srvSettings) => {
        if (!srvSettings || !srvSettings.StorageMode) return;
        if (srvSettings.StorageMode === 'ayo') {
          setActiveTab('ayo');
          setAyoEnabled(true);
          setCustomEnabled(false);
          setAyoErasureEnabled(srvSettings.ErasureCoding);
          setAyoErasureConfig((srvSettings.ErasureCodingConfig as ErasureCodingConfig) || '2+2');
        } else if (srvSettings.StorageMode === 'local') {
          setActiveTab('custom');
          setCustomEnabled(true);
          setAyoEnabled(false);
          setCustomErasureEnabled(srvSettings.ErasureCoding);
          setCustomErasureConfig((srvSettings.ErasureCodingConfig as ErasureCodingConfig) || '2+2');

          // Parse cloud keys
          if (srvSettings.CloudKeys && srvSettings.CloudKeys.length > 0) {
            const loadedProviders = srvSettings.CloudKeys.map((k: Record<string, string>) => {
              const providerType = k.Provider as ProviderType;
              let fields: StorageProvider['fields'] = emptyFields(providerType);
              if (providerType === 'aws') {
                fields = {
                  accessKeyId: k.AccessKeyID || '',
                  secretAccessKey: k.SecretAccessKey || '',
                  region: k.Region || '',
                  bucketName: k.Bucket || '',
                };
              } else if (providerType === 'azure') {
                fields = {
                  storageAccountName: k.AccountName || '',
                  storageAccountKey: k.AccountKey || '',
                  containerName: k.ContainerName || '',
                };
              } else if (providerType === 'gcp') {
                fields = {
                  serviceAccountJson: k.ServiceAccountJSON || '',
                  bucketName: k.Bucket || '',
                };
              } else if (providerType === 'local') {
                fields = {
                  folderName: k.FolderName || '',
                  folderPath: k.FolderPath || '',
                };
              }
              return {
                id: generateId(),
                providerId: k.ID || '',
                type: providerType,
                fields,
                collapsed: true,
              };
            });
            setProviders(loadedProviders);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load settings:', err);
        toast.error('Failed to load settings');
      });
  }, []);

  // -- Provider CRUD --

  const addProvider = (type: ProviderType) => {
    const newProvider: StorageProvider = {
      id: generateId(),
      providerId: makeProviderId(type),
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
      } else if (p.type === 'gcp') {
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
      } else {
        const f = p.fields as LocalFields;
        if (!f.folderName.trim()) errs.folderName = 'Folder Name is required';
        if (!f.folderPath.trim()) errs.folderPath = 'Please choose a folder';
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
        const label =
          p.type === 'azure' ? 'containerName' : p.type === 'local' ? 'folderPath' : 'bucketName';
        if (!newErrors[p.id]) newErrors[p.id] = {};
        newErrors[p.id][label] =
          `Duplicate: another ${providerLabel(p.type)} provider already uses this ${p.type === 'azure' ? 'container' : p.type === 'local' ? 'folder' : 'bucket'}`;
        valid = false;
        // Also mark the original
        const origId = seen.get(key)!;
        if (!newErrors[origId]) newErrors[origId] = {};
        newErrors[origId][label] =
          `Duplicate: another ${providerLabel(p.type)} provider already uses this ${p.type === 'azure' ? 'container' : p.type === 'local' ? 'folder' : 'bucket'}`;
      } else {
        seen.set(key, p.id);
      }
    }

    setProviderErrors(newErrors);
    return valid;
  }, [providers]);

  const handleSaveCustom = async () => {
    if (!validateProviders()) {
      toast.error('Please fix the validation errors before saving.');
      // Expand any providers with errors
      setProviders((prev) =>
        prev.map((p) => (providerErrors[p.id] ? { ...p, collapsed: false } : p))
      );
      return;
    }

    const cloudKeys = providers.map((p) => {
      if (p.type === 'aws') {
        const fields = p.fields as AWSFields;
        return {
          ID: p.providerId,
          Provider: 'aws',
          AccessKeyID: fields.accessKeyId,
          SecretAccessKey: fields.secretAccessKey,
          Region: fields.region,
          Bucket: fields.bucketName,
        };
      } else if (p.type === 'azure') {
        const fields = p.fields as AzureFields;
        return {
          ID: p.providerId,
          Provider: 'azure',
          AccountName: fields.storageAccountName,
          AccountKey: fields.storageAccountKey,
          ContainerName: fields.containerName,
        };
      } else if (p.type === 'gcp') {
        const fields = p.fields as GCPFields;
        return {
          ID: p.providerId,
          Provider: 'gcp',
          ServiceAccountJSON: fields.serviceAccountJson,
          Bucket: fields.bucketName,
        };
      } else {
        const fields = p.fields as LocalFields;
        return {
          ID: p.providerId,
          Provider: 'local',
          FolderName: fields.folderName,
          FolderPath: fields.folderPath,
        };
      }
    });

    const newSettings = new settings.UpdateSettingsInput({
      StorageMode: 'local',
      CloudKeys: cloudKeys,
      ErasureCoding: customErasureEnabled,
      ErasureCodingConfig: customErasureConfig,
    });

    try {
      await UpdateSettings(newSettings);
      toast.success('Storage settings saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings: ' + String(err));
    }
  };

  const handleSaveAyo = async () => {
    const newSettings = new settings.UpdateSettingsInput({
      StorageMode: 'ayo',
      CloudKeys: [],
      ErasureCoding: ayoErasureEnabled,
      ErasureCodingConfig: ayoErasureConfig,
    });

    try {
      await UpdateSettings(newSettings);
      toast.success('Ayo storage settings saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save Ayo settings: ' + String(err));
    }
  };

  // -- Tab classes --
  const tabClass = (id: TabId) =>
    `px-5 py-3 text-sm font-semibold transition-all duration-200 border-b-2 ${
      activeTab === id
        ? 'border-sky-500 text-sky-600 dark:border-sky-400 dark:text-sky-400'
        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-600'
    }`;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Storage Settings</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Configure where your files are stored and how they are protected.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-slate-200 dark:border-slate-700">
        <button type="button" className={tabClass('custom')} onClick={() => setActiveTab('custom')}>
          Custom Storage (Recommended)
        </button>
        <button type="button" className={tabClass('ayo')} onClick={() => setActiveTab('ayo')}>
          Ayo Provided Storage
        </button>
      </div>

      {/* Custom Storage Tab */}
      {activeTab === 'custom' && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800/90">
            <Toggle
              id="custom-storage-toggle"
              label="Enable Custom Storage"
              description="Use your own cloud storage for maximum security and cost control."
              checked={customEnabled}
              onChange={(e) => setCustomEnabled(e.target.checked)}
            />
          </div>

          <div
            className={`space-y-6 transition-opacity duration-200 ${customEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'}`}
          >
            {/* Provider list */}
            <div className="space-y-4">
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
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 dark:border-slate-700 dark:bg-slate-900/30">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Add storage provider:
                </span>
                {(['aws', 'gcp', 'azure', 'local'] as ProviderType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addProvider(type)}
                    disabled={!customEnabled}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:bg-white disabled:hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    {providerLabel(type)}
                  </button>
                ))}
              </div>
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
              <Button type="button" onClick={handleSaveCustom} disabled={!customEnabled}>
                💾 Save Custom Storage Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ayo Provided Storage Tab */}
      {activeTab === 'ayo' && (
        <div className="space-y-6">
          {/* Warning */}
          <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-6 dark:border-amber-700/60 dark:from-amber-950/20 dark:to-yellow-950/20">
            <div className="flex gap-4">
              <div className="rounded-xl bg-amber-100 p-2.5 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-amber-900 dark:text-amber-100">
                  Custom storage is more secure and cheaper
                </p>
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                  Use Ayo Provided Storage only if you want to avoid the technical difficulties of
                  setting up your own cloud storage. Your data will be stored on Ayo-managed
                  infrastructure.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800/90">
            <Toggle
              id="ayo-storage-toggle"
              label="Enable Ayo Provided Storage"
              description="Let Ayo manage your storage infrastructure."
              checked={ayoEnabled}
              disabled
              onChange={(e) => setAyoEnabled(e.target.checked)}
            />
          </div>

          <div
            className={`space-y-6 transition-opacity duration-200 ${ayoEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'}`}
          >
            <ErasureCodingSection
              enabled={ayoErasureEnabled}
              onToggle={setAyoErasureEnabled}
              selectedConfig={ayoErasureConfig}
              onConfigChange={setAyoErasureConfig}
              disabled={!ayoEnabled}
            />

            <div className="pt-2">
              <Button type="button" onClick={handleSaveAyo} disabled={!ayoEnabled}>
                💾 Save Ayo Storage Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
