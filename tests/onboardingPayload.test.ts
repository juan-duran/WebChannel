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

assert.equal(
  payload.employment_status,
  'full_time',
  'employment_status should be mapped to backend enum values',
);
assert.equal(payload.education_level, 'bachelors', 'education_level should be mapped to backend enum values');
assert.equal(payload.family_status, 'married', 'family_status should be mapped to backend enum values');
assert.equal(payload.living_with, 'partner', 'living_with should be mapped to backend enum values');
assert.equal(payload.income_bracket, 'middle', 'income_bracket should be mapped to backend enum values');
assert.equal(payload.religion, 'catholic', 'religion should be mapped to backend enum values');
assert.deepEqual(payload.moral_values, [], 'deselecting every moral value should send an empty array');

console.log('Onboarding payload moral_values reset test passed.');
