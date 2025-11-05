import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import { OutgoingMessageRequest } from '../types/index.js';
import { sessionManager } from '../services/session.js';
import { supabaseService } from '../services/supabase.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/send', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const message: OutgoingMessageRequest = req.body;

    if (!message.content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!message.sessionId && !message.userId && !message.userEmail) {
      return res.status(400).json({ error: 'Session ID, User ID, or User Email is required' });
    }

    let delivered = false;
    let userId: string | undefined;

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
        }));
        delivered = true;
        userId = session.userId;
        logger.info({ userEmail: message.userEmail }, 'Message delivered via WebSocket');
      }
    }

    if (!delivered && userId) {
      const channelId = await supabaseService.getOrCreateDefaultChannel(userId);
      if (channelId) {
        await supabaseService.saveMessage(
          channelId,
          null,
          'assistant',
          message.content,
          message.contentType || 'text',
          message.structuredData,
          message.metadata,
          undefined,
          message.mediaUrl,
          message.mediaType,
          message.mediaCaption
        );
        logger.info({ userId }, 'Message saved to database for offline delivery');
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
