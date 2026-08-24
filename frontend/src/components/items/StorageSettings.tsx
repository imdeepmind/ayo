import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { toErrorMessage } from '@/lib/errors';

import Button from '@/components/bits/Button';
import ConfirmDialog from '@/components/bits/ConfirmDialog';
import TextInput from '@/components/bits/Input';
import Toggle from '@/components/bits/Toggle';
import WarningBanner from '@/components/bits/WarningBanner';
import { type ErasureCodingConfig } from '@/components/items/ErasureCodingSection';

import { settings } from '../../../wailsjs/go/models';
import { GetSettings, PickFolder, UpdateSettings } from '../../../wailsjs/go/settings/Service';

// ---------- Types ----------

type ProviderType =
  | 'aws'
  | 'minio'
  | 'backblaze'
  | 'cloudflare'
  | 'wasabi'
  | 'azure'
  | 'gcp'
  | 'local';

interface S3VendorFields {
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

interface AWSFields extends S3VendorFields {
  region: string;
}

interface BackblazeFields extends S3VendorFields {
  region: string;
}

interface WasabiFields extends S3VendorFields {
  region: string;
}

interface CloudflareFields extends S3VendorFields {
  accountId: string;
}

interface MinIOFields extends S3VendorFields {
  serverUrl: string;
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
  fields:
    | AWSFields
    | MinIOFields
    | BackblazeFields
    | CloudflareFields
    | WasabiFields
    | AzureFields
    | GCPFields
    | LocalFields;
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

function emptyFields(type: ProviderType): StorageProvider['fields'] {
  switch (type) {
    case 'aws':
      return { accessKeyId: '', secretAccessKey: '', region: '', bucketName: '' };
    case 'minio':
      return { serverUrl: '', accessKeyId: '', secretAccessKey: '', bucketName: '' };
    case 'backblaze':
      return { accessKeyId: '', secretAccessKey: '', region: '', bucketName: '' };
    case 'cloudflare':
      return { accountId: '', accessKeyId: '', secretAccessKey: '', bucketName: '' };
    case 'wasabi':
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
  switch (type) {
    case 'aws':
      return 'AWS S3';
    case 'minio':
      return 'MinIO';
    case 'backblaze':
      return 'Backblaze B2';
    case 'cloudflare':
      return 'Cloudflare R2';
    case 'wasabi':
      return 'Wasabi';
    case 'azure':
      return 'Azure Blob';
    case 'gcp':
      return 'Google Cloud';
    case 'local':
      return 'Local System';
  }
}

// providerResource returns the user-named bucket/container/folder a provider
// maps to, used as the card subtitle and to tell providers apart.
function providerResource(p: StorageProvider): string {
  if (p.type === 'azure') return (p.fields as AzureFields).containerName;
  if (p.type === 'gcp') return (p.fields as GCPFields).bucketName;
  if (p.type === 'local') return (p.fields as LocalFields).folderName;
  return (p.fields as S3VendorFields).bucketName;
}

function getBucketOrContainer(p: StorageProvider): string {
  if (p.type === 'azure') return (p.fields as AzureFields).containerName.trim().toLowerCase();
  if (p.type === 'local') return (p.fields as LocalFields).folderPath.trim().toLowerCase();
  return (p.fields as S3VendorFields).bucketName.trim().toLowerCase();
}

// ---------- Sub-components ----------

// S3ProviderFields renders the credential inputs shared by every S3-compatible
// vendor (AWS S3, MinIO, Backblaze B2, Cloudflare R2, Wasabi) plus the few
// vendor-specific fields: Server URL for MinIO, Account ID for Cloudflare R2,
// and Region for AWS/Backblaze/Wasabi. Hosted endpoints are derived in the
// backend, so no endpoint field is shown.
function S3ProviderFields({
  provider,
  update,
  errors,
}: {
  provider: StorageProvider;
  update: (key: string, value: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      {provider.type === 'minio' && (
        <TextInput
          id={`${provider.id}-server-url`}
          label="Server URL"
          placeholder="http://localhost:9000"
          value={(provider.fields as MinIOFields).serverUrl}
          onChange={(e) => update('serverUrl', e.target.value)}
          error={errors.serverUrl}
        />
      )}
      {provider.type === 'cloudflare' && (
        <TextInput
          id={`${provider.id}-account-id`}
          label="Account ID"
          placeholder="Enter your R2 account ID"
          value={(provider.fields as CloudflareFields).accountId}
          onChange={(e) => update('accountId', e.target.value)}
          error={errors.accountId}
        />
      )}
      <TextInput
        id={`${provider.id}-access-key`}
        label="Access Key ID"
        placeholder="AKIA..."
        value={(provider.fields as S3VendorFields).accessKeyId}
        onChange={(e) => update('accessKeyId', e.target.value)}
        error={errors.accessKeyId}
      />
      <TextInput
        id={`${provider.id}-secret-key`}
        label="Secret Access Key"
        type="password"
        placeholder="Enter secret key"
        value={(provider.fields as S3VendorFields).secretAccessKey}
        onChange={(e) => update('secretAccessKey', e.target.value)}
        error={errors.secretAccessKey}
      />
      {(provider.type === 'aws' || provider.type === 'backblaze' || provider.type === 'wasabi') && (
        <TextInput
          id={`${provider.id}-region`}
          label={provider.type === 'backblaze' ? 'Region / Endpoint Code' : 'Region'}
          placeholder={provider.type === 'backblaze' ? 'us-west-004' : 'us-east-1'}
          value={(provider.fields as AWSFields).region}
          onChange={(e) => update('region', e.target.value)}
          error={errors.region}
        />
      )}
      <TextInput
        id={`${provider.id}-bucket`}
        label="Bucket Name"
        placeholder="my-bucket"
        value={(provider.fields as S3VendorFields).bucketName}
        onChange={(e) => update('bucketName', e.target.value)}
        error={errors.bucketName}
      />
    </>
  );
}

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

  const path = (provider.fields as LocalFields).folderPath;

  const pickFolder = async () => {
    try {
      const picked = await PickFolder();
      if (picked) update('folderPath', picked);
    } catch (err) {
      console.error(err);
      toast.error('Failed to open folder picker: ' + String(err));
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface backdrop-blur-sm transition-all duration-200 dark:border-border-strong">
      {/* Header */}
      <button
        type="button"
        onClick={() => onToggleCollapse(provider.id)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-surface-hover/50 dark:hover:bg-surface-hover/30 rounded-t-2xl transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {providerLabel(provider.type)}
          </span>
          <span className="rounded-md bg-surface-alt px-2 py-0.5 font-mono text-[11px] font-semibold text-text-subtle dark:bg-surface-hover dark:text-text-muted">
            {provider.providerId}
          </span>
          {!provider.collapsed && (
            <span className="text-xs font-medium text-text-subtle">
              {providerResource(provider) || 'Untitled'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ChevronDown
            className="h-4 w-4 text-text-faint transition-transform duration-200"
            style={{ transform: provider.collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
        </div>
      </button>

      {/* Body */}
      {!provider.collapsed && (
        <div className="space-y-4 border-t border-border px-6 pb-6 pt-5 dark:border-border-strong">
          {(provider.type === 'aws' ||
            provider.type === 'minio' ||
            provider.type === 'backblaze' ||
            provider.type === 'cloudflare' ||
            provider.type === 'wasabi') && (
            <S3ProviderFields provider={provider} update={update} errors={errors} />
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
                  className="block text-sm font-semibold text-text-muted dark:text-text"
                >
                  Service Account JSON
                </label>
                <textarea
                  id={`${provider.id}-sa-json`}
                  rows={6}
                  placeholder='{"type": "service_account", ...}'
                  value={(provider.fields as GCPFields).serviceAccountJson}
                  onChange={(e) => update('serviceAccountJson', e.target.value)}
                  className={`w-full rounded-xl border ${errors.serviceAccountJson ? 'border-red-400 focus:outline-red-500' : 'border-border-input focus:outline-primary dark:border-border-input'} bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-faint shadow-sm outline-none transition-all duration-200 focus:outline-2 focus:outline-solid focus:outline-offset-1 dark:bg-surface dark:text-text dark:placeholder:text-text-subtle font-mono`}
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
                <p className="text-xs text-text-subtle flex items-start gap-1.5">
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
                  className="block text-sm font-semibold text-text-muted dark:text-text"
                >
                  Folder Location
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={pickFolder}
                    className={`flex-1 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm text-left transition-all duration-200 ${
                      errors.folderPath
                        ? 'border-red-400'
                        : 'border-border-input dark:border-border-input'
                    } bg-surface-alt/60 dark:bg-surface-alt/60 hover:border-primary`}
                  >
                    <svg
                      className="w-4 h-4 shrink-0 text-text-faint"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    <span
                      className={`truncate ${
                        path
                          ? 'font-mono text-text dark:text-text'
                          : 'text-text-faint dark:text-text-subtle'
                      }`}
                    >
                      {path || 'Choose a folder...'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={pickFolder}
                    className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-text-muted shadow-sm transition-all duration-200 hover:border-primary hover:bg-primary/10 hover:text-primary dark:border-border-input dark:bg-surface-alt dark:text-text-muted dark:hover:border-primary/50 dark:hover:bg-primary/20 dark:hover:text-primary"
                  >
                    Browse
                  </button>
                </div>
                {errors.folderPath && (
                  <p className="text-sm text-red-500 dark:text-red-400">{errors.folderPath}</p>
                )}
              </div>
            </>
          )}

          <div className="pt-3 flex items-center justify-end">
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

  // Provider removal confirmation
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

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
              if (
                providerType === 'aws' ||
                providerType === 'backblaze' ||
                providerType === 'wasabi'
              ) {
                fields = {
                  accessKeyId: k.AccessKeyID || '',
                  secretAccessKey: k.SecretAccessKey || '',
                  region: k.Region || '',
                  bucketName: k.Bucket || '',
                };
              } else if (providerType === 'cloudflare') {
                fields = {
                  accountId: k.AccountID || '',
                  accessKeyId: k.AccessKeyID || '',
                  secretAccessKey: k.SecretAccessKey || '',
                  bucketName: k.Bucket || '',
                };
              } else if (providerType === 'minio') {
                fields = {
                  serverUrl: k.Endpoint || '',
                  accessKeyId: k.AccessKeyID || '',
                  secretAccessKey: k.SecretAccessKey || '',
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

  const confirmRemoveProvider = () => {
    if (pendingRemoveId) removeProvider(pendingRemoveId);
    setPendingRemoveId(null);
  };

  const pendingProvider = providers.find((p) => p.id === pendingRemoveId) ?? null;

  // -- Validation --

  const validateProviders = useCallback((): boolean => {
    const newErrors: Record<string, Record<string, string>> = {};
    let valid = true;

    for (const p of providers) {
      const errs: Record<string, string> = {};

      if (p.type === 'aws' || p.type === 'backblaze' || p.type === 'wasabi') {
        const f = p.fields as AWSFields;
        if (!f.accessKeyId.trim()) errs.accessKeyId = 'Access Key ID is required';
        if (!f.secretAccessKey.trim()) errs.secretAccessKey = 'Secret Access Key is required';
        if (!f.region.trim()) errs.region = 'Region is required';
        if (!f.bucketName.trim()) errs.bucketName = 'Bucket Name is required';
      } else if (p.type === 'minio') {
        const f = p.fields as MinIOFields;
        if (!f.serverUrl.trim()) errs.serverUrl = 'Server URL is required';
        if (!f.accessKeyId.trim()) errs.accessKeyId = 'Access Key ID is required';
        if (!f.secretAccessKey.trim()) errs.secretAccessKey = 'Secret Access Key is required';
        if (!f.bucketName.trim()) errs.bucketName = 'Bucket Name is required';
      } else if (p.type === 'cloudflare') {
        const f = p.fields as CloudflareFields;
        if (!f.accountId.trim()) errs.accountId = 'Account ID is required';
        if (!f.accessKeyId.trim()) errs.accessKeyId = 'Access Key ID is required';
        if (!f.secretAccessKey.trim()) errs.secretAccessKey = 'Secret Access Key is required';
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

    // Duplicate bucket/container check. Local providers are excluded: folders
    // are distinguished by their Folder Name, so reusing a path is allowed.
    const seen = new Map<string, string>();
    for (const p of providers) {
      if (p.type === 'local') continue;
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
      } else if (p.type === 'backblaze') {
        const fields = p.fields as BackblazeFields;
        return {
          ID: p.providerId,
          Provider: 'backblaze',
          AccessKeyID: fields.accessKeyId,
          SecretAccessKey: fields.secretAccessKey,
          Region: fields.region,
          Bucket: fields.bucketName,
        };
      } else if (p.type === 'wasabi') {
        const fields = p.fields as WasabiFields;
        return {
          ID: p.providerId,
          Provider: 'wasabi',
          AccessKeyID: fields.accessKeyId,
          SecretAccessKey: fields.secretAccessKey,
          Region: fields.region,
          Bucket: fields.bucketName,
        };
      } else if (p.type === 'cloudflare') {
        const fields = p.fields as CloudflareFields;
        return {
          ID: p.providerId,
          Provider: 'cloudflare',
          AccountID: fields.accountId,
          AccessKeyID: fields.accessKeyId,
          SecretAccessKey: fields.secretAccessKey,
          Bucket: fields.bucketName,
        };
      } else if (p.type === 'minio') {
        const fields = p.fields as MinIOFields;
        return {
          ID: p.providerId,
          Provider: 'minio',
          Endpoint: fields.serverUrl,
          AccessKeyID: fields.accessKeyId,
          SecretAccessKey: fields.secretAccessKey,
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
      toast.error(toErrorMessage(err, 'Failed to save settings. Please try again.'));
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
      toast.error(toErrorMessage(err, 'Failed to save Ayo settings. Please try again.'));
    }
  };

  // -- Tab classes --
  const tabClass = (id: TabId) =>
    `px-5 py-3 text-sm font-semibold transition-all duration-200 border-b-2 ${
      activeTab === id
        ? 'border-primary text-primary'
        : 'border-transparent text-text-subtle hover:text-text hover:border-border-strong dark:text-text-subtle dark:hover:text-text dark:hover:border-border-input'
    }`;

  return (
    <div className="w-full relative space-y-2">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-bold text-text">Storage Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border dark:border-border-strong">
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
          <div className="rounded-2xl border border-border bg-surface backdrop-blur-sm p-6 dark:border-border-strong">
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
                  onRemove={setPendingRemoveId}
                  onToggleCollapse={toggleCollapse}
                  errors={providerErrors[p.id] || {}}
                />
              ))}
            </div>

            {/* Add provider */}
            <div className="rounded-2xl border border-dashed border-border bg-surface-hover/50 p-6 dark:border-border-strong dark:bg-surface">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-text-muted dark:text-text">
                  Add storage provider:
                </span>
                {(
                  [
                    'aws',
                    'minio',
                    'backblaze',
                    'cloudflare',
                    'wasabi',
                    'gcp',
                    'azure',
                    'local',
                  ] as ProviderType[]
                ).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addProvider(type)}
                    disabled={!customEnabled || type === 'gcp' || type === 'azure'}
                    title={type === 'gcp' || type === 'azure' ? 'Coming soon' : undefined}
                    className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-text-muted shadow-sm transition-all duration-200 hover:border-primary hover:bg-primary/10 hover:text-primary hover:shadow-md dark:border-border-input dark:bg-surface-alt dark:text-text-muted dark:hover:border-primary/50 dark:hover:bg-primary/20 dark:hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border-strong disabled:hover:bg-surface disabled:hover:text-text-muted"
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

            {/* Save */}
            <div className="flex justify-end pt-2">
              <Button type="button" onClick={handleSaveCustom} disabled={!customEnabled}>
                Save Custom Storage Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ayo Provided Storage Tab */}
      {activeTab === 'ayo' && (
        <div className="space-y-6">
          {/* Warning */}
          <WarningBanner
            title="Custom storage is more secure and cheaper"
            description="Use Ayo Provided Storage only if you want to avoid the technical difficulties of setting up your own cloud storage. Your data will be stored on Ayo-managed infrastructure."
          />

          <div className="rounded-2xl border border-border bg-surface backdrop-blur-sm p-6 dark:border-border-strong">
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
            <div className="flex justify-end pt-2">
              <Button type="button" onClick={handleSaveAyo} disabled={!ayoEnabled}>
                Save Ayo Storage Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingRemoveId !== null}
        title="Remove Provider"
        message={
          pendingProvider
            ? `Remove the ${providerLabel(pendingProvider.type)} provider${
                pendingProvider.providerId ? ` (${pendingProvider.providerId})` : ''
              }? Files stored with this provider will no longer be accessible through ayo.`
            : 'Remove this provider?'
        }
        confirmLabel="Remove"
        destructive
        onConfirm={confirmRemoveProvider}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  );
}
