import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Database, HardDrive, Settings as SettingsIcon, UserCog } from 'lucide-react';
import SettingsLayout, { type SettingsSection } from '@/components/items/SettingsLayout';
import StorageSettings from '@/components/items/StorageSettings';
import AccountSettings from '@/components/items/AccountSettings';
import ApplicationSettings from '@/components/items/ApplicationSettings';
import DatabaseSettings from '@/components/items/DatabaseSettings';

const sections: SettingsSection[] = [
  { id: 'storage', label: 'Storage Settings', icon: <HardDrive className="h-4 w-4" /> },
  { id: 'database', label: 'Database Settings', icon: <Database className="h-4 w-4" /> },
  { id: 'account', label: 'Account Settings', icon: <UserCog className="h-4 w-4" /> },
  { id: 'application', label: 'Application Settings', icon: <SettingsIcon className="h-4 w-4" /> },
];

export default function Settings() {
  const location = useLocation();
  const sectionFromState = (location.state as { section?: string } | null)?.section;
  const initialSection =
    sectionFromState && sections.some((s) => s.id === sectionFromState)
      ? sectionFromState
      : 'storage';
  const [activeSection, setActiveSection] = useState(initialSection);

  return (
    <SettingsLayout
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {activeSection === 'storage' && <StorageSettings />}
      {activeSection === 'database' && <DatabaseSettings />}
      {activeSection === 'account' && <AccountSettings />}
      {activeSection === 'application' && <ApplicationSettings />}
    </SettingsLayout>
  );
}
