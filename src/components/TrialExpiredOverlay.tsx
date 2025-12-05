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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          background: '#0f172a',
          color: '#f8fafc',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 700 }}>
          Seu teste grátis terminou 🚪
        </h3>
        <p style={{ marginBottom: 16, fontSize: 14, color: '#cbd5e1' }}>
          Antes de sair, responda uma pesquisa rápida (30 segundos) para nos contar como foi a sua experiência com o
          Quenty. Depois você pode escolher um plano para continuar recebendo os resumos.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleSurveyClick}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid transparent',
              background: '#f8fafc',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
            type="button"
          >
            Responder pesquisa rápida (30s)
          </button>
          <button
            onClick={handlePricingClick}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid #334155',
              background: 'transparent',
              color: '#e2e8f0',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
            type="button"
          >
            Ver planos e continuar com o Quenty
          </button>
        </div>
        <p style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
          O acesso continua bloqueado até você escolher um plano. Seu feedback ajuda muito a melhorar o produto.
        </p>
      </div>
    </div>
  );
}
