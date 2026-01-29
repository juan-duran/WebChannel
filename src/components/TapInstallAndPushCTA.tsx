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
      <div className="mb-4 p-4 bg-white border-[3px] border-black shadow-brutal text-sm">
        <div className="font-mono font-bold text-black uppercase tracking-wide mb-2">Quer usar o Quenty como app no iPhone?</div>
        <div className="mb-2 text-gray-700">
          Toque em Compartilhar → <span className="font-bold text-black">Adicionar à Tela de Início</span>. Depois abra o
          Quenty pelo ícone para ativar notificações.
        </div>
        <div className="text-xs text-gray-500">
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
    <div className="mb-4 p-4 bg-white border-[3px] border-black shadow-brutal text-sm flex flex-col gap-3">
      <div className="font-mono font-bold text-black uppercase tracking-wide">Facilite seu dia:</div>
      {showInstallButton && (
        <button
          className="self-start px-4 py-2 bg-black border-2 border-black text-white text-xs font-mono font-bold uppercase shadow-[3px_3px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          onClick={onInstall}
          type="button"
        >
          Instalar app Quenty
        </button>
      )}
      {showPushButton && (
        <button
          className="self-start px-4 py-2 bg-white border-2 border-black text-black text-xs font-mono font-bold uppercase shadow-[3px_3px_0_0_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000000] transition-all"
          onClick={onEnablePush}
          type="button"
        >
          Ativar notificações diárias
        </button>
      )}
    </div>
  );
}
