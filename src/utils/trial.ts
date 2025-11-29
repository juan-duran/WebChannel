import type { CurrentUser } from '../state/UserContext';

export type TrialState =
  | { kind: 'none' }
  | { kind: 'active'; daysLeft: number }
  | { kind: 'expired' }
  | { kind: 'converted' }
  | { kind: 'paid' };

export function getTrialState(user: CurrentUser): TrialState {
  const sub = user.subscriptionStatus;
  const trial = user.trialStatus;
  const expiresAt = user.trialExpiresAt ? new Date(user.trialExpiresAt) : null;
  const now = new Date();

  if (sub === 'paid' || sub === 'active') {
    return { kind: 'paid' };
  }

  if (!trial || trial === 'none') {
    return { kind: 'none' };
  }

  if (trial === 'converted') {
    return { kind: 'converted' };
  }

  if (!expiresAt || isNaN(expiresAt.getTime())) {
    return { kind: 'none' };
  }

  const msDiff = expiresAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

  if (msDiff <= 0) {
    return { kind: 'expired' };
  }

  return { kind: 'active', daysLeft };
}
