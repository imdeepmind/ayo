import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '@/components/bits/Button';
import ErasureCodingSection, {
  type ErasureCodingConfig,
} from '@/components/items/ErasureCodingSection';
import { GetSettings, UpdateSettings } from '../../wailsjs/go/settings/Service';
import { settings } from '../../wailsjs/go/models';

export default function StorageErasureCoding() {
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<ErasureCodingConfig>('2+2');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    GetSettings()
      .then((srvSettings) => {
        if (!srvSettings) return;
        setEnabled(srvSettings.ErasureCoding);
        setConfig((srvSettings.ErasureCodingConfig as ErasureCodingConfig) || '2+2');
      })
      .catch((err) => {
        console.error('Failed to load settings:', err);
        toast.error('Failed to load settings');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const srvSettings = await GetSettings();
      const newSettings = new settings.UpdateSettingsInput({
        StorageMode: srvSettings.StorageMode,
        CloudKeys: srvSettings.CloudKeys || [],
        ErasureCoding: enabled,
        ErasureCodingConfig: config,
      });
      await UpdateSettings(newSettings);
      toast.success('Erasure coding settings saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings: ' + String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text">Erasure Coding</h2>
        <p className="mt-2 text-sm text-text-muted">
          Configure how your files are split into fragments and protected with parity.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-text-subtle">Loading erasure coding settings...</p>
      ) : (
        <div className="space-y-6">
          <ErasureCodingSection
            enabled={enabled}
            onToggle={setEnabled}
            selectedConfig={config}
            onConfigChange={setConfig}
          />
          <div className="pt-2">
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Erasure Coding Settings'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
