import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type OnboardingStatus = {
  complete: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const OnboardingStatusContext = createContext<OnboardingStatus | null>(null);

export function OnboardingStatusProvider({ children }: { children: ReactNode }) {
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding', { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Status HTTP ${res.status}`);
      }
      const body = await res.json().catch(() => ({}));
      const data = body?.data;
      const flag = Boolean(data?.onboarding_complete);
      setComplete(flag);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar status');
      setComplete(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <OnboardingStatusContext.Provider
      value={{
        complete,
        loading,
        error,
        refresh: fetchStatus,
      }}
    >
      {children}
    </OnboardingStatusContext.Provider>
  );
}

export function useOnboardingStatus() {
  const ctx = useContext(OnboardingStatusContext);
  if (!ctx) {
    throw new Error('useOnboardingStatus must be used within OnboardingStatusProvider');
  }
  return ctx;
}
