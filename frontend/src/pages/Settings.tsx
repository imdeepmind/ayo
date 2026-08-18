import AccountSettings from '@/components/items/AccountSettings';
import ApplicationSettings from '@/components/items/ApplicationSettings';

export default function Settings() {
  return (
    <div className="w-full relative space-y-6">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-bold text-text">Settings</h1>
      </div>

      <ApplicationSettings />
      <AccountSettings />
    </div>
  );
}
