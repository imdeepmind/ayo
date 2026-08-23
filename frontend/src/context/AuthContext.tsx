import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import {
  GetSession,
  Login as LoginService,
  Logout as LogoutService,
  Register as RegisterService,
  ResetPassword as ResetPasswordService,
} from '../../wailsjs/go/auth/Service';
import { auth } from '../../wailsjs/go/models';
import { SaveRecoveryKey as SaveRecoveryKeyService } from '../../wailsjs/go/recovery/Service';

interface AuthContextType {
  session: auth.Session | null;
  isLoading: boolean;
  login: (input: auth.LoginInput) => Promise<boolean>;
  register: (input: auth.RegisterInput) => Promise<auth.RegisterResult | null>;
  logout: () => Promise<void>;
  resetPassword: (input: auth.ResetPasswordInput) => Promise<auth.RegisterResult | null>;
  saveRecoveryKey: (username: string, recoveryKey: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<auth.Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = async (): Promise<void> => {
    // Check if Wails bindings are ready with a few retries
    const win = window as unknown as {
      go: { auth: { GetSession: () => Promise<auth.Session | null> } };
    };
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
      const result = await RegisterService(input);

      return result ?? null;
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
      const result = await ResetPasswordService(input);
      return result ?? null;
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  };

  const saveRecoveryKey = async (username: string, recoveryKey: string) => {
    try {
      await SaveRecoveryKeyService(username, recoveryKey);
    } catch (error) {
      console.error('Failed to save recovery key:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        login,
        register,
        logout,
        resetPassword,
        saveRecoveryKey,
        refreshSession,
      }}
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
