import { Outlet } from 'react-router-dom';

import Header from '@/components/items/Header';
import Sidebar from '@/components/items/Sidebar';

export default function AppLayout() {
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
