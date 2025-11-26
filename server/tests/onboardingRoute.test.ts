import assert from 'node:assert/strict';

const { validateOnboardingPayload } = await import('../src/routes/onboarding.js');

const basePayload = {
  handle: 'Maria',
  preferred_send_time: '08:00',
  moral_values: ['fe'],
  employment_status: 'full_time',
  education_level: 'bachelors',
  family_status: 'married',
  living_with: 'partner',
  income_bracket: 'middle',
  religion: 'catholic',
};

const validResult = validateOnboardingPayload(basePayload);
assert.equal(validResult.isValid, true, 'preferred_send_time with HH:mm should be valid');

const optOutResult = validateOnboardingPayload({
  ...basePayload,
  preferred_send_time: null,
});
assert.equal(optOutResult.isValid, true, 'preferred_send_time should be optional/nullable');

const invalidPreferredResult = validateOnboardingPayload({
  ...basePayload,
  preferred_send_time: '99:99',
});

assert.equal(invalidPreferredResult.isValid, false, 'invalid preferred_send_time should fail');
assert(invalidPreferredResult.errors.includes('preferred_send_time must match HH:MM in 24-hour format when provided'));

console.log('Onboarding validation tests passed.');
