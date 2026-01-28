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
    <div className="px-3 py-2 bg-amber-500/20 border-b border-amber-500/30 text-[13px] text-amber-300">
      <strong className="text-amber-200">Teste grátis ativo</strong> — {label}{' '}
      <a
        href="https://www.quenty.com.br/pricing-plans/list"
        className="ml-2 text-accent underline hover:text-accent-hover"
      >
        Ver planos
      </a>
    </div>
  );
}
