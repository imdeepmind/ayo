import { Info } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ActiveTransfersProvider } from '@/context/ActiveTransfersContext';
import { AuthProvider } from '@/context/AuthContext';
import { SearchProvider } from '@/context/SearchContext';

import Header from '@/components/items/Header';
import ProtectedRoute from '@/components/items/ProtectedRoute';
import PublicRoute from '@/components/items/PublicRoute';
import Sidebar from '@/components/items/Sidebar';

import Home from '@/pages/Home';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import Register from '@/pages/Register';
import Reset from '@/pages/Reset';
import SecurityKeyManagement from '@/pages/SecurityKeyManagement';
import Settings from '@/pages/Settings';
import StorageDatabase from '@/pages/StorageDatabase';
import StorageErasureCoding from '@/pages/StorageErasureCoding';
import StorageProviders from '@/pages/StorageProviders';
import Upload from '@/pages/Upload';

import { ThemeProvider } from '@/theme/ThemeProvider';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ActiveTransfersProvider>
          <BrowserRouter>
            <SearchProvider>
              <div className="h-screen w-full overflow-hidden bg-background font-sans text-text flex flex-col">
                <Header />
                <div className="flex flex-1 overflow-hidden">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    <Routes>
                      <Route element={<ProtectedRoute />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/upload" element={<Upload />} />
                        <Route path="/storage/providers" element={<StorageProviders />} />
                        <Route path="/storage/database" element={<StorageDatabase />} />
                        <Route path="/storage/erasure-coding" element={<StorageErasureCoding />} />
                        <Route
                          path="/security/key-management"
                          element={<SecurityKeyManagement />}
                        />
                      </Route>
                      <Route element={<PublicRoute />}>
                        <Route path="/auth/login" element={<Login />} />
                        <Route path="/auth/register" element={<Register />} />
                        <Route path="/auth/reset" element={<Reset />} />
                      </Route>
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                </div>
              </div>
            </SearchProvider>
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--toast-bg)',
                  color: 'var(--toast-color)',
                  border: '1px solid var(--toast-border)',
                  boxShadow: 'none',
                  maxWidth: 'min(92vw, 420px)',
                },
                success: {
                  iconTheme: {
                    primary: 'var(--color-primary)',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
                // Plain toast(...) calls (neutral/info) always show an icon so
                // no notification appears without one.
                blank: {
                  icon: <Info className="h-4 w-4" />,
                  iconTheme: {
                    primary: 'var(--color-primary)',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </BrowserRouter>
        </ActiveTransfersProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
