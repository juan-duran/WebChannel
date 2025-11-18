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

type AssistantMessagePayload = {
  correlationId?: string;
  content?: string;
  contentType?: string;
  structuredData?: any;
  metadata?: any;
  cacheTag?: string;
  buttons?: { label: string; value: string }[];
  webhookResponse?: any;
  mediaUrl?: string;
  mediaType?: string;
  mediaCaption?: string;
};

export class WebSocketService {
  private wss: WebSocketServer;
  private typingTimeouts: Map<string, NodeJS.Timeout>;
  private readonly sessionManagerService: typeof sessionManager;
  private readonly supabaseServiceInstance: typeof supabaseService;
  private readonly n8nServiceInstance: typeof n8nService;
  private readonly userRateLimiterInstance: typeof userRateLimiter;

  private readonly EMPTY_STRUCTURED_RESPONSE_FALLBACK = '[structured response]';

  constructor(
    wss: WebSocketServer,
    deps?: {
      sessionManager?: typeof sessionManager;
      supabaseService?: typeof supabaseService;
      n8nService?: typeof n8nService;
      userRateLimiter?: typeof userRateLimiter;
    }
  ) {
    this.wss = wss;
    this.typingTimeouts = new Map();
    this.sessionManagerService = deps?.sessionManager ?? sessionManager;
    this.supabaseServiceInstance = deps?.supabaseService ?? supabaseService;
    this.n8nServiceInstance = deps?.n8nService ?? n8nService;
    this.userRateLimiterInstance = deps?.userRateLimiter ?? userRateLimiter;
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

    const authResult = await this.supabaseServiceInstance.verifyAuthToken(token);
    if (!authResult) {
      logger.warn('WebSocket connection rejected: invalid token');
      ws.close(1008, 'Invalid authentication token');
      return;
    }

    const { userId, email } = authResult;
    const session = this.sessionManagerService.createSession(ws, userId, email);

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
      this.sessionManagerService.updateHeartbeat(session.sessionId);
    });

    ws.on('close', () => {
      logger.info({ sessionId: session.sessionId }, 'WebSocket connection closed');
      this.sessionManagerService.removeSession(session.sessionId);
    });

    ws.on('error', (error) => {
      logger.error({ sessionId: session.sessionId, error }, 'WebSocket error');
    });

    this.startHeartbeat(session.sessionId);
  }

  private async handleMessage(sessionId: string, data: Buffer) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      const session = this.sessionManagerService.getSession(sessionId);

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

    if (!this.userRateLimiterInstance.check(userId)) {
      logger.warn({ sessionId, userId }, 'User rate limit exceeded');
      const session = this.sessionManagerService.getSession(sessionId);
      if (session) {
        session.ws.send(JSON.stringify({
          type: 'error',
          error: 'Rate limit exceeded. Please wait before sending more messages.',
        }));
      }
      return;
    }

    const correlationId = generateCorrelationId();

    await this.supabaseServiceInstance.logAuditMessage(userId, 'in', {
      message: message.content,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    const channelId = await this.supabaseServiceInstance.getOrCreateDefaultChannel(userId);
    if (channelId) {
      await this.supabaseServiceInstance.saveMessage(
        channelId,
        userId,
        'user',
        message.content,
        'text',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        correlationId
      );
    }

    const session = this.sessionManagerService.getSession(sessionId);
    if (session) {
      session.ws.send(JSON.stringify({
        type: 'typing_start',
        message: 'Quenty-AI is thinking...',
      }));
    }

    try {
      // Dispara o workflow no n8n.
      const workflowResult = await this.n8nServiceInstance.sendMessage(
        userEmail,
        message.content,
        sessionId,
        correlationId,
        userId
      );

      const normalizedImmediateResponse = this.normalizeImmediateWorkflowResponse(
        workflowResult,
        correlationId
      );

      if (session) {
        session.ws.send(JSON.stringify({
          type: 'typing_stop',
        }));
      }

      if (normalizedImmediateResponse) {
        const delivered = this.sendMessageToSession(
          sessionId,
          normalizedImmediateResponse,
          userId,
          userEmail
        );

        if (delivered && channelId) {
          await this.supabaseServiceInstance.saveMessage(
            channelId,
            null,
            'assistant',
            normalizedImmediateResponse.content ?? '',
            normalizedImmediateResponse.contentType ?? 'text',
            normalizedImmediateResponse.structuredData,
            normalizedImmediateResponse.metadata,
            normalizedImmediateResponse.webhookResponse,
            normalizedImmediateResponse.mediaUrl,
            normalizedImmediateResponse.mediaType,
            normalizedImmediateResponse.mediaCaption,
            normalizedImmediateResponse.correlationId ?? correlationId
          );
        }

        await this.supabaseServiceInstance.logAuditMessage(userId, 'out', {
          response:
            normalizedImmediateResponse.content ?? this.EMPTY_STRUCTURED_RESPONSE_FALLBACK,
          correlationId: normalizedImmediateResponse.correlationId ?? correlationId,
          timestamp: new Date().toISOString(),
          delivery: 'immediate',
        });
      } else {
        // Mantém um log de saída simples para auditoria
        await this.supabaseServiceInstance.logAuditMessage(userId, 'out', {
          response: 'n8n workflow triggered',
          correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      // NÃO salva mensagem de assistant aqui quando não há resposta imediata.
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

  private normalizeImmediateWorkflowResponse(
    result: any,
    fallbackCorrelationId: string
  ): AssistantMessagePayload | null {
    if (!result) return null;

    const payloadCandidates = this.collectPayloadCandidates(result);
    const primaryPayload =
      payloadCandidates.length > 0
        ? payloadCandidates[0]
        : Array.isArray(result)
        ? result[0] ?? {}
        : result;
    const candidateObjects = payloadCandidates.length > 0
      ? payloadCandidates
      : typeof primaryPayload === 'object' && primaryPayload !== null
      ? [primaryPayload as Record<string, any>]
      : [];

    const correlationId = this.coalesceString(
      ...candidateObjects.flatMap((candidate) => [
        this.readPath(candidate, 'correlationId'),
        this.readPath(candidate, 'correlation_id'),
        this.readPath(candidate, 'data.correlationId'),
        this.readPath(candidate, 'data.correlation_id'),
      ]),
      fallbackCorrelationId
    );

    const content = this.extractResponseText(primaryPayload);
    const structuredData = this.findFirstDefined(candidateObjects, [
      'structuredData',
      'structured_data',
      'data.structuredData',
      'data.structured_data',
    ]);
    const metadata = this.findFirstDefined(candidateObjects, [
      'metadata',
      'meta',
      'data.metadata',
      'data.meta',
    ]);
    const contentType = this.coalesceString(
      ...candidateObjects.flatMap((candidate) => [
        this.readPath(candidate, 'contentType'),
        this.readPath(candidate, 'content_type'),
        this.readPath(candidate, 'type'),
        this.readPath(candidate, 'data.contentType'),
        this.readPath(candidate, 'data.content_type'),
        this.readPath(candidate, 'data.type'),
      ]),
      structuredData ? 'trends' : undefined
    );
    const cacheTag = this.coalesceString(
      ...candidateObjects.flatMap((candidate) => [
        this.readPath(candidate, 'cacheTag'),
        this.readPath(candidate, 'cache_tag'),
        this.readPath(candidate, 'data.cacheTag'),
        this.readPath(candidate, 'data.cache_tag'),
      ])
    );
    const media = this.resolveMedia(candidateObjects);
    const buttons = this.normalizeButtons(
      this.findFirstDefined(candidateObjects, [
        'buttons',
        'quickReplies',
        'quick_replies',
        'suggestions',
        'options',
        'actions',
        'replies',
        'cta',
        'data.buttons',
        'data.quickReplies',
        'data.quick_replies',
        'data.suggestions',
        'data.options',
        'data.actions',
        'data.replies',
        'data.cta',
      ])
    );
    const webhookResponse = this.findFirstDefined(candidateObjects, [
      'webhookResponse',
      'webhook_response',
      'data.webhookResponse',
      'data.webhook_response',
    ]);

    if (
      !content &&
      !structuredData &&
      !metadata &&
      !media.mediaUrl &&
      !media.mediaType &&
      !media.mediaCaption &&
      !cacheTag &&
      !buttons &&
      !webhookResponse
    ) {
      return null;
    }

    return {
      correlationId,
      content,
      contentType: contentType || (structuredData ? 'trends' : 'text'),
      structuredData,
      metadata,
      cacheTag,
      buttons,
      webhookResponse,
      ...media,
    };
  }

  private coalesceString(...values: any[]): string | undefined {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  private collectPayloadCandidates(value: any): Record<string, any>[] {
    const collected: Record<string, any>[] = [];

    const visit = (node: any) => {
      if (!node) return;

      if (Array.isArray(node)) {
        for (const item of node) {
          visit(item);
        }
        return;
      }

      if (typeof node === 'object' && node !== null) {
        collected.push(node as Record<string, any>);
        if ('output' in (node as any)) {
          visit((node as any).output);
        }
      }
    };

    visit(value);

    return collected;
  }

  private readPath(source: Record<string, any>, path: string): any {
    const segments = path.split('.');
    let current: any = source;

    for (const segment of segments) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      if (!(segment in current)) {
        return undefined;
      }

      current = current[segment];
    }

    return current;
  }

  private findFirstDefined(
    candidates: Record<string, any>[],
    paths: string[]
  ): any {
    for (const candidate of candidates) {
      for (const path of paths) {
        const value = this.readPath(candidate, path);
        if (value !== undefined && value !== null) {
          return value;
        }
      }
    }

    return undefined;
  }

  private resolveMedia(candidates: Record<string, any>[]) {
    const media = { mediaUrl: undefined as string | undefined, mediaType: undefined as string | undefined, mediaCaption: undefined as string | undefined };

    for (const candidate of candidates) {
      const normalized = this.normalizeMedia(candidate);

      if (!media.mediaUrl && normalized.mediaUrl) {
        media.mediaUrl = normalized.mediaUrl;
      }
      if (!media.mediaType && normalized.mediaType) {
        media.mediaType = normalized.mediaType;
      }
      if (!media.mediaCaption && normalized.mediaCaption) {
        media.mediaCaption = normalized.mediaCaption;
      }

      if (media.mediaUrl && media.mediaType && media.mediaCaption) {
        break;
      }
    }

    return media;
  }

  private extractResponseText(data: any): string | undefined {
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) {
      for (const item of data) {
        const extracted = this.extractResponseText(item);
        if (extracted) {
          return extracted;
        }
      }
      return undefined;
    }
    if (typeof data !== 'object' || data === null) return undefined;
    if ('output' in data && (data as any).output) {
      const extracted = this.extractResponseText((data as any).output);
      if (extracted) {
        return extracted;
      }
    }
    const structuredCandidate =
      (data as any).structuredData ??
      (data as any).structured_data ??
      (data as any)?.data?.structuredData ??
      (data as any)?.data?.structured_data ??
      undefined;
    if (structuredCandidate) {
      const extracted = this.extractResponseText(structuredCandidate);
      if (extracted) {
        return extracted;
      }
    }
    if (typeof data.text === 'string') return data.text;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.response === 'string') return data.response;
    if (typeof data.content === 'string') return data.content;
    if (typeof data.reply === 'string') return data.reply;
    if (typeof (data as any).summary === 'string') return (data as any).summary;
    if (typeof (data as any).headline === 'string') return (data as any).headline;
    if (typeof (data as any).description === 'string') return (data as any).description;
    if (typeof (data as any).title === 'string') return (data as any).title;
    if (typeof data.body === 'object' && data.body !== null) {
      const nested = data.body as Record<string, any>;
      if (typeof nested.content === 'string') return nested.content;
      if (typeof nested.text === 'string') return nested.text;
    }
    return undefined;
  }

  private normalizeMedia(payload: any) {
    const media =
      payload.media ??
      payload.mediaPayload ??
      payload.media_payload ??
      payload.data?.media ??
      {};

    const mediaUrl = this.coalesceString(payload.mediaUrl, payload.media_url, media.url);
    const mediaType = this.coalesceString(payload.mediaType, payload.media_type, media.type);
    const mediaCaption = this.coalesceString(
      payload.mediaCaption,
      payload.media_caption,
      media.caption,
      media.text
    );

    return { mediaUrl, mediaType, mediaCaption };
  }

  private normalizeButtons(rawButtons: any) {
    if (!rawButtons) return undefined;

    const candidateArray: unknown[] | undefined = Array.isArray(rawButtons)
      ? rawButtons
      : typeof rawButtons === 'object' && Array.isArray(rawButtons.buttons)
        ? rawButtons.buttons
        : undefined;

    if (!candidateArray) return undefined;

    const normalized: { label: string; value: string }[] = [];

    for (const entry of candidateArray) {
      if (typeof entry === 'string') {
        const value = entry.trim();
        if (value.length > 0) {
          normalized.push({ label: value, value });
        }
        continue;
      }

      if (!entry || typeof entry !== 'object') continue;

      const record = entry as Record<string, unknown>;
      const label = this.coalesceString(
        record['label'],
        record['title'],
        record['text'],
        record['name'],
        record['value'],
        record['payload'],
        record['action']
      );

      const value = this.coalesceString(
        record['value'],
        record['payload'],
        record['action'],
        record['id'],
        record['command']
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
  }

  private startHeartbeat(sessionId: string) {
    const interval = setInterval(() => {
      const session = this.sessionManagerService.getSession(sessionId);
      if (!session) {
        clearInterval(interval);
        return;
      }

      try {
        session.ws.ping();
      } catch (error) {
        logger.warn({ sessionId, error }, 'Heartbeat ping failed');
        clearInterval(interval);
        this.sessionManagerService.removeSession(sessionId);
      }
    }, config.session.heartbeatInterval);
  }

  sendMessageToUser(userId: string, content: string, metadata?: any) {
    const sessions = this.sessionManagerService.getSessionsByUserId(userId);

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

  sendMessageToSession(
    sessionId: string,
    message: AssistantMessagePayload,
    userId: string,
    userEmail?: string
  ) {
    const attemptedSessions = new Set<string>();

    const trySend = (targetSessionId: string, reason: string) => {
      const targetSession = this.sessionManagerService.getSession(targetSessionId);

      if (!targetSession) {
        logger.warn(
          { sessionId: targetSessionId, userId, reason },
          'Session unavailable for message delivery'
        );
        return false;
      }

      if (targetSession.ws.readyState !== WebSocket.OPEN) {
        logger.warn(
          { sessionId: targetSessionId, userId, readyState: targetSession.ws.readyState, reason },
          'Session WebSocket not open for message delivery'
        );
        return false;
      }

      try {
        targetSession.ws.send(JSON.stringify({
          type: 'message',
          role: 'assistant',
          correlationId: message.correlationId,
          content: message.content,
          contentType: message.contentType ?? 'text',
          structuredData: message.structuredData,
          metadata: message.metadata,
          cacheTag: message.cacheTag,
          buttons: message.buttons,
          webhookResponse: message.webhookResponse,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          mediaCaption: message.mediaCaption,
        }));
        return true;
      } catch (error) {
        logger.error({ sessionId: targetSessionId, userId, error, reason }, 'Failed to send message to session');
        return false;
      }
    };

    const primaryDelivered = trySend(sessionId, 'primary session');
    attemptedSessions.add(sessionId);

    if (primaryDelivered) {
      return true;
    }

    let delivered = false;

    const userSessions = this.sessionManagerService.getSessionsByUserId(userId);
    for (const session of userSessions) {
      if (attemptedSessions.has(session.sessionId)) continue;
      logger.info({ sessionId: session.sessionId, userId }, 'Attempting fallback delivery via user sessions');
      attemptedSessions.add(session.sessionId);
      delivered = trySend(session.sessionId, 'fallback by userId');
      if (delivered) {
        return true;
      }
    }

    if (userEmail) {
      const emailSession = this.sessionManagerService.getSessionByEmail(userEmail);
      if (emailSession && !attemptedSessions.has(emailSession.sessionId)) {
        logger.info(
          { sessionId: emailSession.sessionId, userId, userEmail },
          'Attempting fallback delivery via user email'
        );
        delivered = trySend(emailSession.sessionId, 'fallback by email');
        if (delivered) {
          return true;
        }
      }
    }

    logger.error({ sessionId, userId, userEmail }, 'Failed to deliver message to any active session');
    return false;
  }
}
