import crypto from 'crypto';

export function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
}

export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}
