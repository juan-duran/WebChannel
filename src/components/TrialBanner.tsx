import type { TrialState } from '../utils/trial';

type Props = {
  trialState: TrialState;
};

export function TrialBanner({ trialState }: Props) {
  if (trialState.kind !== 'active') return null;

  const days = trialState.daysLeft;
  const label =
    days <= 1
      ? 'Seu teste grátis termina em menos de 24 horas.'
      : `Seu teste grátis termina em ${days} dias.`;

  return (
    <div
      style={{
        padding: '8px 12px',
        background: '#FFF5CC',
        borderBottom: '1px solid #F5D46B',
        fontSize: 13,
      }}
    >
      <strong>Teste grátis ativo</strong> — {label}{' '}
      <a
        href="https://www.quenty.com.br/pricing-plans/list"
        style={{ marginLeft: 8, textDecoration: 'underline' }}
      >
        Ver planos
      </a>
    </div>
  );
}
