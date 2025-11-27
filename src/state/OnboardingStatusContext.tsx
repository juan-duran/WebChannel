import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type OnboardingStatus = {
  complete: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const OnboardingStatusContext = createContext<OnboardingStatus | null>(null);

const normalizePreferredSendTime = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.slice(0, 5);
  if (/^\d{1,2}$/.test(trimmed)) return `${trimmed.padStart(2, '0')}:00`;
  return trimmed;
};

const computeCompletion = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false;

  const handle = typeof data.handle === 'string' ? data.handle.trim() : '';
  const preferredSendTime = normalizePreferredSendTime(data.preferred_send_time);
  const preferredSendTimeOptOut = data.preferred_send_time === null;

  const requiredFields = [
    data.employment_status,
    data.education_level,
    data.family_status,
    data.living_with,
    data.income_bracket,
    data.religion,
  ];

  const hasMandatoryFields = requiredFields.every((f) => !!f);
  const hasMoralValues = Array.isArray(data.moral_values) && data.moral_values.length > 0;
  const hasPreferred = preferredSendTimeOptOut || Boolean(preferredSendTime);

  return Boolean(handle && hasPreferred && hasMandatoryFields && hasMoralValues);
};

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
      const flag = Boolean(
        data?.onboarding_complete === true ? true : computeCompletion(data)
      );
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
