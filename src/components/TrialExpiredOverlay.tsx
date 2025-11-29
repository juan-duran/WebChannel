import type { TrialState } from '../utils/trial';

type Props = {
  trialState: TrialState;
};

export function TrialExpiredOverlay({ trialState }: Props) {
  if (trialState.kind !== 'expired') return null;

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
          maxWidth: 420,
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
          textAlign: 'center',
        }}
      >
        <h3 style={{ marginBottom: 12 }}>Seu teste grátis terminou</h3>
        <p style={{ marginBottom: 20, fontSize: 14 }}>
          Para continuar usando o Quenty AI e recebendo resumos diários,
          ative um plano.
        </p>
        <a
          href="https://www.quenty.com.br/pricing-plans/list"
          style={{
            display: 'inline-block',
            padding: '10px 18px',
            background: '#111827',
            color: '#fff',
            borderRadius: 4,
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          Ver planos e assinar
        </a>
      </div>
    </div>
  );
}
