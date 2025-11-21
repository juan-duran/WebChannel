import { supabase } from './supabase';

type SummaryResponse = {
  success: boolean;
  correlationId?: string;
  structuredData?: any;
  content?: string | null;
  error?: string;
};

export async function fetchSummaryHttpFallback(
  trendId: string | number | undefined,
  topicId: string | number,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/agent/summary', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      trendId,
      topicId,
      email: session?.user?.email,
      userId: session?.user?.id,
    }),
  });

  const data: SummaryResponse = await res.json();
  return data;
}

