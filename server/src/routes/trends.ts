import { randomUUID } from 'crypto';
import { Router } from 'express';
import fetch from 'node-fetch';
import { n8nService } from '../services/n8n.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

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
  summary?: unknown;
  topicId?: string;
  trendId?: string;
  metadata?: Record<string, unknown> | null;
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

  const trendId = coalesceString(
    (data as any).trendId,
    (data as any).trend_id,
    (data as any).assunto,
    (data as any)?.metadata?.trendId,
    (data as any)?.metadata?.['trend-id'],
    (data as any)?.metadata?.trendName,
    (data as any)?.metadata?.['trend-name'],
  );
  const topicId = coalesceString(
    (data as any).topicId,
    (data as any).topic_id,
    (data as any).topico,
    (data as any)?.metadata?.topicId,
    (data as any)?.metadata?.['topic-id'],
    (data as any)?.metadata?.topicName,
    (data as any)?.metadata?.['topic-name'],
  );

  const structuredDataCandidates = [
    (data as any).structuredData,
    (data as any).structured_data,
    (data as any).output?.structuredData,
    (data as any).output?.structured_data,
    (data as any).output?.data?.structuredData,
    (data as any).output?.data?.structured_data,
    (data as any).data?.structuredData,
    (data as any).data?.structured_data,
    (data as any).payload?.structuredData,
    (data as any).payload?.structured_data,
  ];

  for (const candidate of structuredDataCandidates) {
    if (candidate && typeof candidate === 'object' && (candidate as any).summary !== undefined) {
      const summary = (candidate as any).summary;
      const metadata = (candidate as any).metadata ?? null;
      const extractedTrendId =
        trendId ??
        coalesceString(
          (candidate as any).trendId,
          (candidate as any)['trend-id'],
          (candidate as any).trendName,
          (candidate as any)['trend-name'],
        );
      const extractedTopicId =
        topicId ??
        coalesceString(
          (candidate as any).topicId,
          (candidate as any)['topic-id'],
          (candidate as any).topicName,
          (candidate as any)['topic-name'],
        );

      return {
        summary,
        trendId: extractedTrendId,
        topicId: extractedTopicId,
        metadata,
      };
    }
  }

  if (summaryCandidate) {
    return { summary: summaryCandidate, trendId, topicId, metadata: (data as any).metadata ?? null };
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
        metadata: extracted.metadata ?? (data as any).metadata ?? null,
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

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const correlationId = randomUUID();
  const message = trendId ? `Assunto ${trendId} topico ${topicId}` : `Topico ${topicId}`;

  try {
    const agentResponse = await n8nService.sendMessage(email, message, sessionId, correlationId, userId);

    const extracted = extractSummaryFields(agentResponse);

    const summary = extracted?.summary ?? coalesceString(agentResponse) ?? message;
    const resolvedTrendId =
      trendId ??
      extracted?.trendId ??
      coalesceString(
        extracted?.metadata?.trendId,
        extracted?.metadata?.['trend-id'],
        extracted?.metadata?.trendName,
        extracted?.metadata?.['trend-name'],
      ) ??
      null;
    const resolvedTopicId =
      topicId ??
      extracted?.topicId ??
      coalesceString(
        extracted?.metadata?.topicId,
        extracted?.metadata?.['topic-id'],
        extracted?.metadata?.topicName,
        extracted?.metadata?.['topic-name'],
      ) ??
      null;
    const metadata = (extracted?.metadata as Record<string, unknown> | null | undefined) ?? null;

    return res.json({ summary, trendId: resolvedTrendId, topicId: resolvedTopicId, metadata, correlationId });
  } catch (error) {
    logger.error({ error, topicId, trendId, correlationId }, 'Failed to summarize trend');
    return res.status(500).json({ error: 'Failed to summarize trend' });
  }
});

trendsRouter.post('/summarize-fut', async (req, res) => {
  const topicId = coalesceString(req.body?.topicId, req.body?.topic_id, req.body?.topic);
  const trendId = coalesceString(req.body?.trendId, req.body?.trend_id, req.body?.assunto);
  const email = coalesceString(req.body?.email, req.user?.email);
  const sessionId = coalesceString(req.body?.sessionId, req.body?.session_id) ?? `trends-${randomUUID()}`;
  const userId = coalesceString(req.body?.userId, req.body?.user_id, req.user?.id) ?? 'anonymous';

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const webhookUrl = config.n8n.futebolWebhookUrl;
  if (!webhookUrl) {
    logger.error({ topicId, trendId }, 'Missing N8N_FUTEBOL_WEBHOOK_URL');
    return res.status(500).json({ error: 'missing_futebol_webhook' });
  }

  const correlationId = randomUUID();
  const message = trendId ? `Assunto ${trendId}` : topicId ? `Assunto ${topicId}` : 'Assunto';

  try {
    const agentResponse = await n8nService.sendMessage(
      email,
      message,
      sessionId,
      correlationId,
      userId,
      webhookUrl,
    );

    const extracted = extractSummaryFields(agentResponse);

    const summary = extracted?.summary ?? coalesceString(agentResponse) ?? message;
    const resolvedTrendId =
      trendId ??
      extracted?.trendId ??
      coalesceString(
        extracted?.metadata?.trendId,
        extracted?.metadata?.['trend-id'],
        extracted?.metadata?.trendName,
        extracted?.metadata?.['trend-name'],
      ) ??
      null;
    const resolvedTopicId =
      topicId ??
      extracted?.topicId ??
      coalesceString(
        extracted?.metadata?.topicId,
        extracted?.metadata?.['topic-id'],
        extracted?.metadata?.topicName,
        extracted?.metadata?.['topic-name'],
      ) ??
      null;
    const metadata = (extracted?.metadata as Record<string, unknown> | null | undefined) ?? null;

    return res.json({ summary, trendId: resolvedTrendId, topicId: resolvedTopicId, metadata, correlationId });
  } catch (error) {
    logger.error({ error, topicId, trendId, correlationId, webhookUrl }, 'Failed to summarize futebol trend');
    return res.status(500).json({ error: 'Failed to summarize trend' });
  }
});

trendsRouter.post('/summarize-fof', async (req, res) => {
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

  const webhookUrl = config.n8n.fofocasWebhookUrl;
  if (!webhookUrl) {
    logger.error({ topicId, trendId }, 'Missing N8N_FOFOCAS_WEBHOOK_URL');
    return res.status(500).json({ error: 'missing_fofocas_webhook' });
  }

  const correlationId = randomUUID();
  const threadId = trendId || topicId || 'desconhecido';
  const message = threadId;

  try {
    const agentResponse = await n8nService.sendMessage(
      email,
      message,
      sessionId,
      correlationId,
      userId,
      webhookUrl,
    );

    const extracted = extractSummaryFields(agentResponse);

    const summary = extracted?.summary ?? coalesceString(agentResponse) ?? message;
    const resolvedTrendId =
      trendId ??
      extracted?.trendId ??
      coalesceString(
        extracted?.metadata?.trendId,
        extracted?.metadata?.['trend-id'],
        extracted?.metadata?.trendName,
        extracted?.metadata?.['trend-name'],
      ) ??
      null;
    const resolvedTopicId =
      topicId ??
      extracted?.topicId ??
      coalesceString(
        extracted?.metadata?.topicId,
        extracted?.metadata?.['topic-id'],
        extracted?.metadata?.topicName,
        extracted?.metadata?.['topic-name'],
      ) ??
      null;
    const metadata = (extracted?.metadata as Record<string, unknown> | null | undefined) ?? null;

    return res.json({ summary, trendId: resolvedTrendId, topicId: resolvedTopicId, metadata, correlationId });
  } catch (error) {
    logger.error({ error, topicId, trendId, correlationId, webhookUrl }, 'Failed to summarize fofocas trend');
    return res.status(500).json({ error: 'Failed to summarize trend' });
  }
});

export default trendsRouter;
