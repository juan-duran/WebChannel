import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import { OutgoingMessageRequest } from '../types/index.js';
import { sessionManager } from '../services/session.js';
import { supabaseService } from '../services/supabase.js';
import { logger } from '../utils/logger.js';

type NormalizedButton = { label: string; value: string };

type NormalizedOutgoingMessage = Omit<OutgoingMessageRequest, 'buttons'> & {
  buttons?: NormalizedButton[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const coalesceString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return undefined;
};

const normalizeButtons = (rawButtons: unknown): NormalizedButton[] | undefined => {
  if (!rawButtons) return undefined;

  const candidateArray: unknown[] | undefined = Array.isArray(rawButtons)
    ? rawButtons
    : isRecord(rawButtons) && Array.isArray((rawButtons as Record<string, unknown>).buttons)
      ? ((rawButtons as Record<string, unknown>).buttons as unknown[])
      : undefined;

  if (!candidateArray) {
    return undefined;
  }

  const normalized: NormalizedButton[] = [];

  for (const entry of candidateArray) {
    if (typeof entry === 'string') {
      const value = entry.trim();
      if (value.length > 0) {
        normalized.push({ label: value, value });
      }
      continue;
    }

    if (!isRecord(entry)) continue;

    const label = coalesceString(
      entry['label'],
      entry['title'],
      entry['text'],
      entry['name'],
      entry['value'],
      entry['payload'],
      entry['action'],
    );

    const value = coalesceString(
      entry['value'],
      entry['payload'],
      entry['action'],
      entry['id'],
      entry['command'],
    );

    if (label && value) {
      normalized.push({ label, value });
    } else if (label) {
      normalized.push({ label, value: label });
    } else if (value) {
      normalized.push({ label: value, value });
    }
  }

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeOutgoingMessageRequest = (raw: unknown): NormalizedOutgoingMessage => {
  const source = (isRecord(raw) ? raw : {}) as Record<string, unknown>;

  const nestedUser = isRecord(source['user']) ? (source['user'] as Record<string, unknown>) : undefined;
  const nestedBody = isRecord(source['body']) ? (source['body'] as Record<string, unknown>) : undefined;
  const nestedMedia = isRecord(source['media']) ? (source['media'] as Record<string, unknown>) : undefined;
  const nestedData = isRecord(source['data']) ? (source['data'] as Record<string, unknown>) : undefined;
  const nestedPayload = isRecord(source['payload']) ? (source['payload'] as Record<string, unknown>) : undefined;

  const sessionId = coalesceString(
    source['sessionId'],
    source['session_id'],
    source['sessionID'],
    source['session'],
  );

  const userId = coalesceString(
    source['userId'],
    source['user_id'],
    nestedUser?.id,
  );

  const userEmail = coalesceString(
    source['userEmail'],
    source['user_email'],
    source['email'],
    nestedUser?.email,
  );

  const content = coalesceString(
    source['content'],
    source['message'],
    source['text'],
    source['reply'],
    nestedBody?.content,
    nestedBody?.text,
  );

  const contentType = coalesceString(
    source['contentType'],
    source['content_type'],
    source['type'],
  );

  const mediaUrl = coalesceString(
    source['mediaUrl'],
    source['media_url'],
    nestedMedia?.url,
  );

  const mediaType = coalesceString(
    source['mediaType'],
    source['media_type'],
    nestedMedia?.type,
  );

  const mediaCaption = coalesceString(
    source['mediaCaption'],
    source['media_caption'],
    source['caption'],
  );

  const cacheTag = coalesceString(
    source['cacheTag'],
    source['cache_tag'],
  );

  const structuredData =
    source['structuredData'] ??
    source['structured_data'] ??
    (nestedData ? nestedData['structuredData'] : undefined) ??
    (nestedPayload ? nestedPayload['structuredData'] : undefined);

  const metadata =
    source['metadata'] ??
    source['meta'] ??
    (nestedData ? nestedData['metadata'] : undefined) ??
    (nestedPayload ? nestedPayload['metadata'] : undefined);

  const webhookResponse =
    source['webhookResponse'] ??
    source['webhook_response'] ??
    (nestedData ? nestedData['webhookResponse'] : undefined);

  const buttonsSource =
    source['buttons'] ??
    source['quickReplies'] ??
    source['quick_replies'] ??
    source['suggestions'] ??
    source['options'] ??
    source['actions'] ??
    source['replies'] ??
    source['cta'];

  return {
    sessionId: sessionId || undefined,
    userId: userId || undefined,
    userEmail: userEmail || undefined,
    content: content ?? '',
    contentType: contentType || undefined,
    structuredData,
    metadata,
    mediaUrl: mediaUrl || undefined,
    mediaType: mediaType || undefined,
    mediaCaption: mediaCaption || undefined,
    cacheTag: cacheTag || undefined,
    buttons: normalizeButtons(buttonsSource),
    webhookResponse,
  };
};

const router = Router();

router.post('/send', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const message = normalizeOutgoingMessageRequest(req.body);

    if (!message.content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!message.sessionId && !message.userId && !message.userEmail) {
      return res.status(400).json({ error: 'Session ID, User ID, or User Email is required' });
    }

    let delivered = false;
    let userId: string | undefined = message.userId;

    if (message.sessionId) {
      const session = sessionManager.getSession(message.sessionId);
      if (session) {
        session.ws.send(JSON.stringify({
          type: 'message',
          role: 'assistant',
          content: message.content,
          contentType: message.contentType || 'text',
          structuredData: message.structuredData,
          metadata: message.metadata,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          mediaCaption: message.mediaCaption,
          cacheTag: message.cacheTag,
          buttons: message.buttons,
          webhookResponse: message.webhookResponse,
        }));
        delivered = true;
        userId = session.userId;
        logger.info({ sessionId: message.sessionId }, 'Message delivered via WebSocket');
      }
    } else if (message.userId) {
      const sessions = sessionManager.getSessionsByUserId(message.userId);
      if (sessions.length > 0) {
        for (const session of sessions) {
          session.ws.send(JSON.stringify({
            type: 'message',
            role: 'assistant',
            content: message.content,
            contentType: message.contentType || 'text',
            structuredData: message.structuredData,
            metadata: message.metadata,
            mediaUrl: message.mediaUrl,
            mediaType: message.mediaType,
            mediaCaption: message.mediaCaption,
            cacheTag: message.cacheTag,
            buttons: message.buttons,
            webhookResponse: message.webhookResponse,
          }));
        }
        delivered = true;
        userId = message.userId;
        logger.info({ userId: message.userId, sessionsCount: sessions.length }, 'Message delivered to all user sessions');
      }
    } else if (message.userEmail) {
      const session = sessionManager.getSessionByEmail(message.userEmail);
      if (session) {
        session.ws.send(JSON.stringify({
          type: 'message',
          role: 'assistant',
          content: message.content,
          contentType: message.contentType || 'text',
          structuredData: message.structuredData,
          metadata: message.metadata,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          mediaCaption: message.mediaCaption,
          cacheTag: message.cacheTag,
          buttons: message.buttons,
          webhookResponse: message.webhookResponse,
        }));
        delivered = true;
        userId = session.userId;
        logger.info({ userEmail: message.userEmail }, 'Message delivered via WebSocket');
      }
    }

    const fallbackUserId = userId || message.userId;

    if (!delivered && fallbackUserId) {
      const channelId = await supabaseService.getOrCreateDefaultChannel(fallbackUserId);
      if (channelId) {
        await supabaseService.saveMessage(
          channelId,
          null,
          'assistant',
          message.content,
          message.contentType || 'text',
          message.structuredData,
          message.metadata,
          message.webhookResponse,
          message.mediaUrl,
          message.mediaType,
          message.mediaCaption
        );
        logger.info({ userId: fallbackUserId }, 'Message saved to database for offline delivery');
      }
    }

    res.json({
      success: true,
      delivered,
      message: delivered ? 'Message delivered' : 'User offline, message queued',
    });

  } catch (error: any) {
    logger.error({ error }, 'Error sending message');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
