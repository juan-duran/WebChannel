import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { enableNotifications } from '../lib/pushNotifications';
import { useWebpushStatus } from '../hooks/useWebpushStatus';

const DISMISS_KEY = 'webpush_banner_dismissed';

const getDismissedFromStorage = () => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
};

const setDismissedInStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISMISS_KEY, 'true');
  } catch {
    // ignore storage errors
  }
};

export function WebPushBanner() {
  const [dismissed, setDismissed] = useState<boolean>(getDismissedFromStorage());
  const { enabled, refresh, loading } = useWebpushStatus({ auto: false });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!dismissed) {
      refresh();
    }
  }, [dismissed, refresh]);

  useEffect(() => {
    if (enabled) {
      setDismissed(true);
      setDismissedInStorage();
    }
  }, [enabled]);

  const handleDismiss = () => {
    setDismissed(true);
    setDismissedInStorage();
  };

  const handleEnable = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await enableNotifications();
      await refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível ativar as notificações.';
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  if (dismissed || enabled) {
    return null;
  }

  return (
    <div className="max-w-screen-md w-full mx-auto mt-4">
      <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 shadow-sm">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-blue-700/80 hover:text-blue-900"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-blue-900">
              Quer receber um alerta quando seu resumo diário estiver pronto?
            </p>
            <p className="text-xs text-blue-800">
              Ative as notificações do navegador para saber assim que seu resumo ficar disponível.
            </p>
            {actionError && <p className="text-xs text-red-700">{actionError}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleEnable}
                disabled={actionLoading || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actionLoading ? 'Ativando...' : 'Ativar notificações'}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-100"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
