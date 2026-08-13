import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Info } from 'lucide-react';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Reset from '@/pages/Reset';
import NotFound from '@/pages/NotFound';
import Settings from '@/pages/Settings';
import Upload from '@/pages/Upload';
import StorageProviders from '@/pages/StorageProviders';
import StorageDatabase from '@/pages/StorageDatabase';
import StorageErasureCoding from '@/pages/StorageErasureCoding';
import SecurityKeyManagement from '@/pages/SecurityKeyManagement';
import Header from '@/components/items/Header';
import Sidebar from '@/components/items/Sidebar';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import { ActiveTransfersProvider } from '@/context/ActiveTransfersContext';
import { SearchProvider } from '@/context/SearchContext';
import ProtectedRoute from '@/components/items/ProtectedRoute';
import PublicRoute from '@/components/items/PublicRoute';

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
