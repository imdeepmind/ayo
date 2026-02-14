import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  GetSession,
  Login as LoginService,
  Logout as LogoutService,
  Register as RegisterService,
} from '../../wailsjs/go/auth/Service';
import { auth } from '../../wailsjs/go/models';

interface AuthContextType {
  session: auth.Session | null;
  isLoading: boolean;
  login: (input: auth.LoginInput) => Promise<boolean>;
  register: (input: auth.RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<auth.Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = async () => {
    try {
      const sess = await GetSession();
      // Wails might return null or an empty object/struct for nil pointer?
      // Assuming it returns null if *Session is nil in Go.
      // If it returns a zero-value struct, we might need to check UserId !== 0.
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
      if (user) {
        // Automatically login after register?
        // For now, let's just return true and let the component handle it (e.g. redirect to login or auto-login)
        // Check if the backend auto-logins. The Service.Register just returns *User, so it probably doesn't set the session.
        // We'll trust the caller to handle the flow, or we can auto-login here.
        // The prompt said "logged it user cannot access login,register...".
        // Usually, register -> login -> home.
        // Let's just return true/false based on user creation.
        return true;
      }
      return false;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    await LogoutService();
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, isLoading, login, register, logout, refreshSession }}
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
