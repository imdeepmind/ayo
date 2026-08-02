import { useState } from 'react';
import { HardDrive, Settings as SettingsIcon, UserCog } from 'lucide-react';
import SettingsLayout, { type SettingsSection } from '@/components/items/SettingsLayout';
import StorageSettings from '@/components/items/StorageSettings';
import AccountSettings from '@/components/items/AccountSettings';
import ApplicationSettings from '@/components/items/ApplicationSettings';

const sections: SettingsSection[] = [
  { id: 'storage', label: 'Storage Settings', icon: <HardDrive className="h-4 w-4" /> },
  { id: 'account', label: 'Account Settings', icon: <UserCog className="h-4 w-4" /> },
  { id: 'application', label: 'Application Settings', icon: <SettingsIcon className="h-4 w-4" /> },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState('storage');

  return (
    <SettingsLayout
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {activeSection === 'storage' && <StorageSettings />}
      {activeSection === 'account' && <AccountSettings />}
      {activeSection === 'application' && <ApplicationSettings />}
    </SettingsLayout>
  );
}
