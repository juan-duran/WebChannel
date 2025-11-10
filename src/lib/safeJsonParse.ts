export function safeJsonParse<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'object') {
    return value as T;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    if (looksLikeJson) {
      console.warn('Failed to parse JSON content', error);
    }
    return null;
  }
}
