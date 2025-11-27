import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type CurrentUser = {
  userId: string;
  email: string;
};

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        const response = await fetch('/api/session', { credentials: 'include' });

        if (!response.ok) {
          throw new Error('Failed to fetch session');
        }

        const data = await response.json();

        if (data?.userId && data?.email) {
          if (isMounted) {
            setCurrentUser({ userId: data.userId, email: data.email });
          }
        } else {
          window.location.href = 'https://www.quenty.com.br/puente';
        }
      } catch {
        window.location.href = 'https://www.quenty.com.br/puente';
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || !currentUser) {
    return null;
  }

  return <UserContext.Provider value={currentUser}>{children}</UserContext.Provider>;
}

export function useCurrentUser() {
  const context = useContext(UserContext);

  if (context === null) {
    throw new Error('useCurrentUser must be used within a UserProvider');
  }

  return context;
}
