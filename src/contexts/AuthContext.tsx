import { createContext, useContext, useEffect, useState } from 'react';
import {
  WixUser,
  getStoredWixToken,
  clearWixToken,
  shouldRefreshToken,
  refreshWixToken
} from '../lib/wixAuthService';

type AuthContextType = {
  user: WixUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<WixUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = getStoredWixToken();
    setUser(storedUser);
    setLoading(false);

    if (storedUser && shouldRefreshToken(storedUser)) {
      refreshWixToken(storedUser.email).then(refreshedUser => {
        if (refreshedUser) {
          setUser(refreshedUser);
        } else {
          clearWixToken();
          setUser(null);
        }
      });
    }

    const interval = setInterval(() => {
      const currentUser = getStoredWixToken();
      if (currentUser && shouldRefreshToken(currentUser)) {
        refreshWixToken(currentUser.email).then(refreshedUser => {
          if (refreshedUser) {
            setUser(refreshedUser);
          } else {
            clearWixToken();
            setUser(null);
          }
        });
      }
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const signOut = async () => {
    await clearWixToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
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
