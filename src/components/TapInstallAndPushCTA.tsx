import { useEffect } from 'react';
import { isIos, isStandaloneMode } from '../lib/pwaEnvironment';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';
import { enableNotifications } from '../lib/pushNotifications';
import { useWebpushStatus } from '../hooks/useWebpushStatus';
import { trackEvent } from '../lib/analytics';

export function TapInstallAndPushCTA() {
  const ios = isIos();
  const standalone = isStandaloneMode();
  const { canInstall, promptInstall } = usePwaInstallPrompt();
  const { enabled, refresh, loading } = useWebpushStatus({ auto: true });

  const showInstallButton = !standalone && canInstall && !ios;
  const showPushButton = !enabled && !ios;

  useEffect(() => {
    if (showInstallButton || showPushButton) {
      trackEvent('pwa_install_cta_shown', {
        context: 'tap',
        ios,
        standalone,
        show_install: showInstallButton,
        show_push: showPushButton,
      });
    }

    if (showPushButton) {
      trackEvent('webpush_enable_cta_shown', { context: 'tap' });
    }
  }, [showInstallButton, showPushButton, ios, standalone]);

  if (loading) return null;

  // iOS web (não standalone): instrução de adicionar à Tela Inicial
  if (ios && !standalone) {
    return (
      <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm text-text-primary">
        <div className="font-semibold mb-1">Quer usar o Quenty como app no iPhone?</div>
        <div className="mb-2 text-text-secondary">
          Toque em Compartilhar → <span className="font-semibold text-text-primary">Adicionar à Tela de Início</span>. Depois abra o
          Quenty pelo ícone para ativar notificações.
        </div>
        <div className="text-xs text-text-muted">
          Enquanto isso, você continua recebendo seu resumo diário pelo WhatsApp.
        </div>
      </div>
    );
  }

  if (!showInstallButton && !showPushButton) return null;

  const onInstall = async () => {
    trackEvent('pwa_install_cta_clicked', { context: 'tap' });
    const ok = await promptInstall();
    trackEvent('pwa_install_cta_prompt_result', {
      context: 'tap',
      result: ok ? 'accepted' : 'dismissed',
    });
  };

  const onEnablePush = async () => {
    trackEvent('webpush_enable_cta_clicked', { context: 'tap' });
    try {
      await enableNotifications();
      await refresh();
      trackEvent('webpush_enable_result', { context: 'tap', ok: true });
    } catch (err) {
      console.error('[TapInstallAndPushCTA] failed to enable push', err);
      trackEvent('webpush_enable_result', {
        context: 'tap',
        ok: false,
        error: String(err),
      });
    }
  };

  return (
    <div className="mb-4 p-3 rounded-xl bg-dark-secondary border border-border-primary text-sm flex flex-col gap-2">
      <div className="font-semibold text-text-primary">Facilite seu dia:</div>
      {showInstallButton && (
        <button
          className="self-start px-3 py-1 rounded-lg bg-accent text-dark-primary text-xs font-semibold hover:bg-accent-hover transition-colors"
          onClick={onInstall}
          type="button"
        >
          Instalar app Quenty
        </button>
      )}
      {showPushButton && (
        <button
          className="self-start px-3 py-1 rounded-lg bg-dark-tertiary border border-border-secondary text-text-primary text-xs font-semibold hover:bg-dark-elevated transition-colors"
          onClick={onEnablePush}
          type="button"
        >
          Ativar notificações diárias
        </button>
      )}
    </div>
  );
}
