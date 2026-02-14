import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Reset from '@/pages/Reset';
import Header from '@/components/items/Header';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/items/ProtectedRoute';
import PublicRoute from '@/components/items/PublicRoute';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
            <Header />
            <main className="flex-1">
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Home />} />
                </Route>
                <Route element={<PublicRoute />}>
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/auth/register" element={<Register />} />
                  <Route path="/auth/reset" element={<Reset />} />
                </Route>
              </Routes>
            </main>
          </div>
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
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
