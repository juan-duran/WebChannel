import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
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
      <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 shadow-sm">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-amber-400/80 hover:text-amber-300"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-dark-tertiary text-amber-400 shadow-sm">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-text-primary">
              Ative as notificações para receber seu resumo diário.
            </p>
            <p className="text-xs text-text-secondary">
              Sem notificações ativas não conseguimos entregar as 15 notícias do dia para você. Habilite o alerta do navegador para ser avisado assim que seu resumo ficar pronto.
            </p>
            {actionError && <p className="text-xs text-red-400">{actionError}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleEnable}
                disabled={actionLoading || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-dark-primary shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actionLoading ? 'Ativando...' : 'Ativar notificações'}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-dark-tertiary px-3 py-2 text-xs font-semibold text-amber-400 transition-colors hover:bg-dark-elevated"
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
