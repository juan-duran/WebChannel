import { useCallback, useEffect, useState } from 'react';

type StatusResponse = {
  enabled?: boolean;
};

type UseWebpushStatusOptions = {
  auto?: boolean;
};

export function useWebpushStatus(options?: UseWebpushStatusOptions) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(options?.auto ?? true));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/webpush/status', { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`status_request_failed_${res.status}`);
      }
      const data = (await res.json()) as StatusResponse;
      setEnabled(Boolean(data?.enabled));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      setError(message);
      console.error('[webpush status] fetch failed', { message: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options?.auto === false) return;
    refresh();
  }, [options?.auto, refresh]);

  return { enabled, loading, error, refresh };
}
