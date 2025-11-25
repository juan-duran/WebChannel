import assert from 'node:assert/strict';
import type { FormState } from '../src/pages/OnboardingPage';

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY ||= 'public-anon-key';

const { buildOnboardingPayload, toggleMoralValueSelection } = await import('../src/pages/OnboardingPage');

const formState: FormState = {
  handle: 'Maria',
  preferred_send_time: '12:00',
  onboarding_complete: false,
  employment_status: 'tempo_integral',
  education_level: 'graduacao',
  family_status: 'casado',
  living_with: 'parceiro',
  income_bracket: 'media',
  religion: 'catolico',
  moral_values: [],
};

const withSelection = {
  ...formState,
  moral_values: toggleMoralValueSelection(formState.moral_values, 'fe'),
};

const withoutSelections = {
  ...withSelection,
  moral_values: toggleMoralValueSelection(withSelection.moral_values, 'fe'),
};

const payload = buildOnboardingPayload(withoutSelections);

assert.deepEqual(payload.moral_values, [], 'deselecting every moral value should send an empty array');

console.log('Onboarding payload moral_values reset test passed.');
