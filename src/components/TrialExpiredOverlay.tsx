import { useEffect } from 'react';
import type { TrialState } from '../utils/trial';
import { trackEvent } from '../lib/analytics';

const TRIAL_SURVEY_URL = 'https://forms.office.com/r/7hCVThSNZB';
const PRICING_URL = 'https://www.quenty.com.br/pricing-plans/list';

type Props = {
  trialState: TrialState;
};

export function TrialExpiredOverlay({ trialState }: Props) {
  if (trialState.kind !== 'expired') return null;

  useEffect(() => {
    trackEvent('trial_expired_overlay_shown');
  }, []);

  const handleSurveyClick = () => {
    trackEvent('trial_survey_opened');
    window.open(TRIAL_SURVEY_URL, '_blank', 'noopener,noreferrer');
  };

  const handlePricingClick = () => {
    trackEvent('trial_pricing_clicked');
    window.location.href = PRICING_URL;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="max-w-[460px] w-full bg-dark-secondary border border-border-primary rounded-2xl p-6 shadow-2xl">
        <h3 className="mb-3 text-lg font-bold text-text-primary">
          Seu teste grátis terminou 🚪
        </h3>
        <p className="mb-4 text-sm text-text-secondary">
          Antes de sair, responda uma pesquisa rápida (30 segundos) para nos contar como foi a sua experiência com o
          Quenty. Depois você pode escolher um plano para continuar recebendo os resumos.
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleSurveyClick}
            className="w-full px-3.5 py-3 rounded-xl border border-transparent bg-accent text-dark-primary font-bold text-sm cursor-pointer transition-colors hover:bg-accent-hover"
            type="button"
          >
            Responder pesquisa rápida (30s)
          </button>
          <button
            onClick={handlePricingClick}
            className="w-full px-3.5 py-3 rounded-xl border border-border-secondary bg-transparent text-text-primary font-semibold text-sm cursor-pointer transition-colors hover:bg-dark-tertiary"
            type="button"
          >
            Ver planos e continuar com o Quenty
          </button>
        </div>
        <p className="mt-3 text-xs text-text-muted leading-relaxed">
          O acesso continua bloqueado até você escolher um plano. Seu feedback ajuda muito a melhorar o produto.
        </p>
      </div>
    </div>
  );
}
