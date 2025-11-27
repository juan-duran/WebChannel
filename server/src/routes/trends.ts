import { randomUUID } from 'crypto';
import { Router } from 'express';
import { n8nService } from '../services/n8n.js';
import { logger } from '../utils/logger.js';

const trendsRouter = Router();

const coalesceString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = String(value).trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return undefined;
};

type SummaryExtraction = {
  summary?: string;
  topicId?: string;
  trendId?: string;
};

const extractSummaryFields = (data: any): SummaryExtraction | undefined => {
  if (data === null || data === undefined) return undefined;

  if (typeof data === 'string' || typeof data === 'number') {
    const normalized = String(data).trim();
    return normalized.length > 0 ? { summary: normalized } : undefined;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const extracted = extractSummaryFields(item);
      if (extracted?.summary) return extracted;
    }
    return undefined;
  }

  if (typeof data !== 'object') return undefined;

  const summaryCandidate = coalesceString(
    (data as any).summary,
    (data as any).text,
    (data as any).message,
    (data as any).content,
    (data as any).reply,
    (data as any).headline,
    (data as any).description,
    (data as any).title,
    (data as any)?.body?.content,
    (data as any)?.body?.text,
  );

  const trendId = coalesceString((data as any).trendId, (data as any).trend_id, (data as any).assunto);
  const topicId = coalesceString((data as any).topicId, (data as any).topic_id, (data as any).topico);

  if (summaryCandidate) {
    return { summary: summaryCandidate, trendId, topicId };
  }

  const nestedCandidates = [
    (data as any).output,
    (data as any).data,
    (data as any).payload,
    (data as any).structuredData,
    (data as any).structured_data,
    (data as any)?.data?.structuredData,
    (data as any)?.data?.structured_data,
  ];

  for (const nested of nestedCandidates) {
    const extracted = extractSummaryFields(nested);
    if (extracted?.summary) {
      return {
        summary: extracted.summary,
        trendId: extracted.trendId ?? trendId,
        topicId: extracted.topicId ?? topicId,
      };
    }
  }

  return undefined;
};

trendsRouter.post('/summarize', async (req, res) => {
  const topicId = coalesceString(req.body?.topicId, req.body?.topic_id, req.body?.topic);
  const trendId = coalesceString(req.body?.trendId, req.body?.trend_id, req.body?.assunto);
  const email = coalesceString(req.body?.email, req.user?.email);
  const sessionId = coalesceString(req.body?.sessionId, req.body?.session_id) ?? `trends-${randomUUID()}`;
  const userId = coalesceString(req.body?.userId, req.body?.user_id, req.user?.id) ?? 'anonymous';

  if (!topicId) {
    return res.status(400).json({ error: 'topicId is required' });
  }

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const correlationId = randomUUID();
  const message = trendId ? `Assunto ${trendId} topico ${topicId}` : `Topico ${topicId}`;

  try {
    const agentResponse = await n8nService.sendMessage(email, message, sessionId, correlationId, userId);

    const extracted = extractSummaryFields(agentResponse);

    const summary = extracted?.summary ?? coalesceString(agentResponse) ?? message;
    const resolvedTrendId = trendId ?? extracted?.trendId ?? null;
    const resolvedTopicId = topicId ?? extracted?.topicId ?? null;

    return res.json({ summary, trendId: resolvedTrendId, topicId: resolvedTopicId, correlationId });
  } catch (error) {
    logger.error({ error, topicId, trendId, correlationId }, 'Failed to summarize trend');
    return res.status(500).json({ error: 'Failed to summarize trend' });
  }
});

export default trendsRouter;
