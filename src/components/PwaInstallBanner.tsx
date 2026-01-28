import { useEffect, useState } from 'react';
import { isIos, isStandaloneMode } from '../lib/pwaEnvironment';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';
import { trackEvent } from '../lib/analytics';

export function PwaInstallBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { canInstall, promptInstall } = usePwaInstallPrompt();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDismissed(localStorage.getItem('pwa_install_banner_dismissed') === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (typeof window === 'undefined') return null;

  const ios = isIos();
  const standalone = isStandaloneMode();
  const shouldShow = !standalone && !ios && canInstall && !dismissed;

  useEffect(() => {
    if (!shouldShow) return;
    trackEvent('pwa_install_banner_shown', {
      location: 'global',
      is_ios: ios,
      is_standalone: standalone,
    });
  }, [shouldShow, ios, standalone]);

  if (!shouldShow) return null;

  const onDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('pwa_install_banner_dismissed', 'true');
    } catch {
      // ignore
    }

    trackEvent('pwa_install_banner_dismissed', { location: 'global' });
  };

  const onInstall = async () => {
    trackEvent('pwa_install_clicked', { location: 'global' });
    const accepted = await promptInstall();
    trackEvent('pwa_install_prompt_result', {
      location: 'global',
      result: accepted ? 'accepted' : 'dismissed',
    });
    if (accepted) {
      onDismiss();
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-8 md:right-auto md:max-w-md bg-dark-secondary border border-border-primary text-text-primary rounded-xl shadow-lg p-4 z-50">
      <div className="font-semibold mb-1 text-text-primary">Instale o app Quenty</div>
      <div className="text-sm mb-3 text-text-secondary">Acesse seu resumo diário mais rápido, como se fosse um app nativo.</div>
      <div className="flex gap-2 justify-end">
        <button
          className="px-3 py-1 rounded-lg text-xs border border-border-secondary text-text-secondary hover:bg-dark-tertiary"
          onClick={onDismiss}
          type="button"
        >
          Agora não
        </button>
        <button
          className="px-3 py-1 rounded-lg text-xs bg-accent text-dark-primary font-semibold hover:bg-accent-hover"
          onClick={onInstall}
          type="button"
        >
          Instalar app
        </button>
      </div>
    </div>
  );
}
