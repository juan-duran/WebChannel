import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { sessionManager } from './session.js';
import { supabaseService } from './supabase.js';
import { n8nService } from './n8n.js';
import { logger } from '../utils/logger.js';
import { WebSocketMessage } from '../types/index.js';
import { generateCorrelationId } from '../utils/crypto.js';
import { userRateLimiter } from '../middleware/rateLimit.js';
import { config } from '../config/index.js';

export class WebSocketService {
  private wss: WebSocketServer;
  private typingTimeouts: Map<string, NodeJS.Timeout>;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.typingTimeouts = new Map();
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      await this.handleConnection(ws, req);
    });

    logger.info('WebSocket server setup complete');
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    const query = parse(req.url || '', true).query;
    const token = query.token as string;

    if (!token) {
      logger.warn('WebSocket connection rejected: missing token');
      ws.close(1008, 'Authentication required');
      return;
    }

    const authResult = await supabaseService.verifyAuthToken(token);
    if (!authResult) {
      logger.warn('WebSocket connection rejected: invalid token');
      ws.close(1008, 'Invalid authentication token');
      return;
    }

    const { userId, email } = authResult;
    const session = sessionManager.createSession(ws, userId, email);

    logger.info({ sessionId: session.sessionId, userId, email }, 'WebSocket connection established');

    ws.send(JSON.stringify({
      type: 'connected',
      sessionId: session.sessionId,
      message: 'Connected to WebChannel',
    }));

    ws.on('message', async (data: Buffer) => {
      await this.handleMessage(session.sessionId, data);
    });

    ws.on('pong', () => {
      sessionManager.updateHeartbeat(session.sessionId);
    });

    ws.on('close', () => {
      logger.info({ sessionId: session.sessionId }, 'WebSocket connection closed');
      sessionManager.removeSession(session.sessionId);
    });

    ws.on('error', (error) => {
      logger.error({ sessionId: session.sessionId, error }, 'WebSocket error');
    });

    this.startHeartbeat(session.sessionId);
  }

  private async handleMessage(sessionId: string, data: Buffer) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        logger.warn({ sessionId }, 'Session not found for message');
        return;
      }

      logger.debug({ sessionId, messageType: message.type }, 'Received WebSocket message');

      switch (message.type) {
        case 'ping':
          session.ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'message':
          await this.handleChatMessage(session.sessionId, session.userId, session.userEmail, message);
          break;

        case 'typing_start':
          break;

        case 'typing_stop':
          break;

        case 'read_receipt':
          await this.handleReadReceipt(session.userId, message.messageId);
          break;

        default:
          logger.warn({ sessionId, messageType: message.type }, 'Unknown message type');
      }
    } catch (error) {
      logger.error({ sessionId, error }, 'Error handling WebSocket message');
    }
  }

  private async handleChatMessage(sessionId: string, userId: string, userEmail: string, message: WebSocketMessage) {
    if (!message.content) {
      logger.warn({ sessionId }, 'Message content missing');
      return;
    }

    if (!userRateLimiter.check(userId)) {
      logger.warn({ sessionId, userId }, 'User rate limit exceeded');
      const session = sessionManager.getSession(sessionId);
      if (session) {
        session.ws.send(JSON.stringify({
          type: 'error',
          error: 'Rate limit exceeded. Please wait before sending more messages.',
        }));
      }
      return;
    }

    const correlationId = generateCorrelationId();

    await supabaseService.logAuditMessage(userId, 'in', {
      message: message.content,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    const channelId = await supabaseService.getOrCreateDefaultChannel(userId);
    if (channelId) {
      await supabaseService.saveMessage(channelId, userId, 'user', message.content);
    }

    const session = sessionManager.getSession(sessionId);
    if (session) {
      session.ws.send(JSON.stringify({
        type: 'typing_start',
        message: 'Quenty-AI is thinking...',
      }));
    }

    try {
      // Dispara o workflow no n8n, mas NÃO usa a resposta HTTP como mensagem de chat.
      // A resposta limpa é enviada pela tool ResponderChat via /api/messages/send.
      await n8nService.sendMessage(userEmail, message.content, sessionId, correlationId, userId);

      if (session) {
        session.ws.send(JSON.stringify({
          type: 'typing_stop',
        }));
      }

      // Mantém um log de saída simples para auditoria
      await supabaseService.logAuditMessage(userId, 'out', {
        response: 'n8n workflow triggered',
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // NÃO salva mensagem de assistant aqui.
      // As mensagens do assistant passam a vir apenas via /api/messages/send.

    } catch (error: any) {
      logger.error({ sessionId, correlationId, error }, 'Error processing message');

      if (session) {
        session.ws.send(JSON.stringify({
          type: 'typing_stop',
        }));

        session.ws.send(JSON.stringify({
          type: 'error',
          error: error.message || 'Failed to process message',
          correlationId,
        }));
      }
    }
  }

  private async handleReadReceipt(userId: string, messageId?: string) {
    if (!messageId) return;

    logger.debug({ userId, messageId }, 'Read receipt received');
  }

  private extractResponseText(data: any): string {
    if (typeof data === 'string') return data;
    if (data.text) return data.text;
    if (data.message) return data.message;
    if (data.response) return data.response;
    if (data.content) return data.content;
    return JSON.stringify(data, null, 2);
  }

  private startHeartbeat(sessionId: string) {
    const interval = setInterval(() => {
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        clearInterval(interval);
        return;
      }

      try {
        session.ws.ping();
      } catch (error) {
        logger.warn({ sessionId, error }, 'Heartbeat ping failed');
        clearInterval(interval);
        sessionManager.removeSession(sessionId);
      }
    }, config.session.heartbeatInterval);
  }

  sendMessageToUser(userId: string, content: string, metadata?: any) {
    const sessions = sessionManager.getSessionsByUserId(userId);

    for (const session of sessions) {
      try {
        session.ws.send(JSON.stringify({
          type: 'message',
          role: 'assistant',
          content,
          metadata,
        }));
      } catch (error) {
        logger.error({ sessionId: session.sessionId, error }, 'Failed to send message to user');
      }
    }
  }

  sendMessageToSession(sessionId: string, content: string, metadata?: any) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn({ sessionId }, 'Session not found for message delivery');
      return false;
    }

    try {
      session.ws.send(JSON.stringify({
        type: 'message',
        role: 'assistant',
        content,
        metadata,
      }));
      return true;
    } catch (error) {
      logger.error({ sessionId, error }, 'Failed to send message to session');
      return false;
    }
  }
}
