type CorrelationEntry = {
  sessionId: string;
  userId: string;
  userEmail?: string;
  createdAt: number;
};

const correlationMap = new Map<string, CorrelationEntry>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export function trackCorrelation(
  correlationId: string,
  sessionId: string,
  userId: string,
  userEmail?: string,
): void {
  correlationMap.set(correlationId, {
    sessionId,
    userId,
    userEmail,
    createdAt: Date.now(),
  });
}

export function resolveCorrelation(correlationId?: string): CorrelationEntry | null {
  if (!correlationId) return null;

  const entry = correlationMap.get(correlationId);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > TTL_MS) {
    correlationMap.delete(correlationId);
    return null;
  }

  return entry;
}

export function clearCorrelation(correlationId?: string): void {
  if (!correlationId) return;
  correlationMap.delete(correlationId);
}
