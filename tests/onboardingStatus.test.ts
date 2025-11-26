import assert from 'node:assert/strict';
import type { FormState } from '../src/pages/OnboardingPage';

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY ||= 'public-anon-key';

const { hasCompleteOnboardingData } = await import('../src/pages/OnboardingPage');

const completeState: FormState = {
  handle: 'Maria',
  preferred_send_time: '12:00',
  preferred_send_time_opt_out: false,
  onboarding_complete: true,
  employment_status: 'tempo_integral',
  education_level: 'graduacao',
  family_status: 'casado',
  living_with: 'parceiro',
  income_bracket: 'media',
  religion: 'catolico',
  moral_values: [],
};

assert.equal(
  hasCompleteOnboardingData(completeState),
  true,
  'A fully populated profile should be considered complete.',
);

(['handle', 'employment_status', 'education_level', 'family_status', 'living_with', 'income_bracket', 'religion'] as const)
  .forEach((field) => {
    const incompleteState = { ...completeState, [field]: '' } as FormState;
    const statusLabel = hasCompleteOnboardingData(incompleteState) ? 'Perfil completo' : 'Onboarding pendente';

    assert.equal(
      statusLabel,
      'Onboarding pendente',
      `Missing ${field} should mark onboarding as pending.`,
    );
  });

const missingPreferredTimeState: FormState = {
  ...completeState,
  preferred_send_time: '',
  preferred_send_time_opt_out: false,
};

assert.equal(
  hasCompleteOnboardingData(missingPreferredTimeState),
  false,
  'Empty preferred send time without opt-out should keep onboarding pending.',
);

const optedOutTimeState: FormState = {
  ...completeState,
  preferred_send_time: '',
  preferred_send_time_opt_out: true,
};

assert.equal(
  hasCompleteOnboardingData(optedOutTimeState),
  true,
  'Preferred send time can be empty when opt-out is selected.',
);

console.log('Onboarding status completeness tests passed.');
