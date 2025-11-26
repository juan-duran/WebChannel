import assert from 'node:assert/strict';
import type { FormState } from '../src/pages/OnboardingPage';

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY ||= 'public-anon-key';

const { hasCompletedOnboarding } = await import('../src/pages/OnboardingPage');

const baseState: FormState = {
  handle: 'Maria',
  preferred_send_time: '12:00',
  preferred_send_time_opt_out: false,
  onboarding_complete: false,
  employment_status: 'tempo_integral',
  education_level: 'graduacao',
  family_status: 'casado',
  living_with: 'parceiro',
  income_bracket: 'media',
  religion: 'catolico',
  moral_values: ['fe'],
};

assert.equal(
  hasCompletedOnboarding(baseState),
  true,
  'should consider the onboarding complete when every required field is filled',
);

const withoutMoralValues = { ...baseState, moral_values: [] };
assert.equal(
  hasCompletedOnboarding(withoutMoralValues),
  false,
  'should not mark onboarding complete when moral values are empty',
);

const withoutPreferredSendTime = { ...baseState, preferred_send_time: '', preferred_send_time_opt_out: false };
assert.equal(
  hasCompletedOnboarding(withoutPreferredSendTime),
  false,
  'should not mark onboarding complete when preferred send time is missing without opting out',
);

const withPreferredSendTimeOptOut = {
  ...withoutPreferredSendTime,
  preferred_send_time_opt_out: true,
};
assert.equal(
  hasCompletedOnboarding(withPreferredSendTimeOptOut),
  true,
  'should allow completion when preferred send time is empty but the user opted out',
);

console.log('Onboarding completion status tests passed.');
