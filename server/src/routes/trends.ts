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

    return res.json({
      success: true,
      data: agentResponse,
      topicId,
      trendId: trendId ?? null,
      correlationId,
    });
  } catch (error) {
    logger.error({ error, topicId, trendId, correlationId }, 'Failed to summarize trend');
    return res.status(500).json({ error: 'Failed to summarize trend' });
  }
});

export default trendsRouter;
