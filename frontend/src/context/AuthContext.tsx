import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  GetSession,
  Login as LoginService,
  Logout as LogoutService,
  Register as RegisterService,
  ResetPassword as ResetPasswordService,
} from '../../wailsjs/go/auth/Service';
import { auth } from '../../wailsjs/go/models';

interface AuthContextType {
  session: auth.Session | null;
  isLoading: boolean;
  login: (input: auth.LoginInput) => Promise<boolean>;
  register: (input: auth.RegisterInput) => Promise<auth.User | null>;
  logout: () => Promise<void>;
  resetPassword: (input: auth.ResetPasswordInput) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<auth.Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = async () => {
    // Check if Wails bindings are ready with a few retries
    const win = window as any;
    let retries = 0;
    while ((!win.go || !win.go.auth) && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    if (!win.go || !win.go.auth) {
      setIsLoading(false);
      return;
    }

    try {
      const sess = await GetSession();
      if (sess && sess.UserId !== 0) {
        setSession(sess);
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('Failed to get session:', error);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (input: auth.LoginInput) => {
    const success = await LoginService(input);
    if (success) {
      await refreshSession();
    }
    return success;
  };

  const register = async (input: auth.RegisterInput) => {
    try {
      const user = await RegisterService(input);

      return user ?? null;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    await LogoutService();
    setSession(null);
  };

  const resetPassword = async (input: auth.ResetPasswordInput) => {
    try {
      await ResetPasswordService(input);
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, isLoading, login, register, logout, resetPassword, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
