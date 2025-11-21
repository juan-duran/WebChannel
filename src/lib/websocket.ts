import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { TapNavigationStructuredData } from '../types/tapNavigation';

export type WebSocketButton = {
  label: string;
  value: string;
};

export type WebSocketMessageType =
  | 'connected'
  | 'message'
  | 'typing_start'
  | 'typing_stop'
  | 'error'
  | 'ping'
  | 'pong';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  sessionId?: string;
  correlationId?: string;
  role?: 'user' | 'assistant';
  content?: string;
  contentType?: 'text' | 'image' | 'video' | 'link' | 'trends' | 'topics' | 'summary';
  structuredData?: TapNavigationStructuredData | any;
  metadata?: any;
  mediaUrl?: string;
  mediaType?: string;
  mediaCaption?: string;
  cacheTag?: string;
  webhookResponse?: any;
  message?: string;
  error?: string;
  messageId?: string;
  buttons?: WebSocketButton[];
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

type RequestStatus = 'pending' | 'fulfilled' | 'canceled' | 'failed';

type QueuedRequest = {
  message: WebSocketMessage;
  attempts: number;
  maxRetries: number;
  status: RequestStatus;
  expectsCorrelation: boolean;
  enqueueTimestamp: number;
  isSending: boolean;
  hasSentSuccessfully: boolean;
  timeoutId?: ReturnType<typeof setTimeout>;
};

type ReplayFailureHandler = (correlationId: string) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private handlers: Map<WebSocketMessageType, Set<WebSocketEventHandler>> = new Map();
  private correlationHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private replayFailureHandlers: Map<string, Set<ReplayFailureHandler>> = new Map();
  private requestQueue: Map<string, QueuedRequest> = new Map();
  private isIntentionallyClosed = false;
  private heartbeatInterval: number | null = null;
  private connectionPromise: Promise<void> | null = null;
  private sessionReadyPromise: Promise<void> | null = null;
  private resolveSessionReady: (() => void) | null = null;
  private sessionReadyPromiseVersion = 0;
  private isReconnecting = false;
  private readonly defaultMaxRequestRetries = 3;
  private requestTimeoutMs = 20000;
  private sessionReadyTimeoutMs = 10000;

  constructor(private wsUrl: string) {}

  private clearConnectionPromise() {
    this.connectionPromise = null;
  }

  private resetSessionReadyPromise() {
    this.resolveSessionReady = null;

    const version = ++this.sessionReadyPromiseVersion;
    const handshakePromise = new Promise<void>((resolve) => {
      this.resolveSessionReady = () => {
        if (this.sessionReadyPromiseVersion === version) {
          resolve();
          this.resolveSessionReady = null;
        }
      };
    });

    this.sessionReadyPromise = handshakePromise;
  }

  private resolveSessionReadyPromise() {
    if (this.resolveSessionReady) {
      this.resolveSessionReady();
      this.resolveSessionReady = null;
    }

    if (!this.sessionReadyPromise) {
      this.resetSessionReadyPromise();
    }
  }

  private logConnectionFailure(reason: string, error?: unknown) {
    const baseError = error instanceof Error ? { message: error.message, stack: error.stack } : { error };
    console.error('[WebSocketService][ConnectionFailure]', {
      event: 'websocket_connection_failure',
      reason,
      reconnectAttempts: this.reconnectAttempts,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      ...baseError,
    });
  }

  private logConnectionBreadcrumb(event: string, payload?: Record<string, unknown>) {
    console.log('[WebSocketService]', {
      event,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      ...(payload ?? {}),
    });
  }

  private async ensureActiveSession(): Promise<Session> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      this.logConnectionFailure('session_lookup_failed', sessionError);
    }

    if (sessionData?.session) {
      return sessionData.session;
    }

    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      this.logConnectionFailure('session_refresh_failed', refreshError);
    }

    if (refreshedData?.session) {
      this.logConnectionBreadcrumb('session_refreshed');
      return refreshedData.session;
    }

    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) {
      this.logConnectionFailure('anonymous_sign_in_failed', anonError);
    }

    if (anonData?.session) {
      this.logConnectionBreadcrumb('anonymous_session_created');
      return anonData.session;
    }

    const sessionMissingError = Object.assign(new Error('SESSION_MISSING'), { code: 'SESSION_MISSING' });
    this.logConnectionFailure('session_missing', sessionMissingError);
    throw sessionMissingError;
  }

  async connect(): Promise<void> {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        return;
      }

      if (this.ws.readyState === WebSocket.CONNECTING && this.connectionPromise) {
        return this.connectionPromise;
      }
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isIntentionallyClosed = false;
    this.sessionId = null;
    this.resetSessionReadyPromise();

    const connectionPromise = (async () => {
      let session: Session;

      try {
        session = await this.ensureActiveSession();
      } catch (error) {
        this.logConnectionFailure('session_bootstrap_failed', error);
        throw error;
      }

      const token = session.access_token;
      const url = `${this.wsUrl}?token=${encodeURIComponent(token)}`;

      await new Promise<void>((resolve, reject) => {
        this.sessionId = null;
        this.resetSessionReadyPromise();

        const ws = new WebSocket(url);
        this.ws = ws;
        let isOpen = false;

        ws.onopen = () => {
          isOpen = true;
          console.log('WebSocket connected');
          const wasReconnecting = this.isReconnecting || this.reconnectAttempts > 0;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.isReconnecting = false;
          this.startHeartbeat();
          if (wasReconnecting) {
            this.replayPendingRequests();
          }
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (event) => {
          console.error('WebSocket error:', event);

          const error =
            event instanceof ErrorEvent
              ? event.error || new Error(event.message)
              : new Error('WebSocket connection error');

          this.logConnectionFailure('websocket_error', error);

          if (!isOpen) {
            if (!this.isReconnecting) {
              this.notifyHandlers('error', {
                type: 'error',
                error: event instanceof ErrorEvent ? event.message : 'Connection error',
              });
            }

            reject(error);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket closed');
          const isCurrentSocket = this.ws === ws;

          if (isCurrentSocket) {
            this.stopHeartbeat();
            this.ws = null;

            this.sessionId = null;
            this.resetSessionReadyPromise();

            if (this.isIntentionallyClosed) {
              this.notifyHandlers('error', { type: 'error', error: 'Connection closed' });
            }
          }

          if (!isOpen) {
            const error = this.isIntentionallyClosed
              ? new Error('WebSocket connection intentionally closed')
              : new Error('WebSocket connection closed before opening');
            this.logConnectionFailure('websocket_closed_before_open', error);
            reject(error);
          }

          if (isCurrentSocket && !this.isIntentionallyClosed) {
            this.attemptReconnect();
          }
        };
      });
    })();

    const guardedPromise = connectionPromise
      .catch((error) => {
        this.logConnectionFailure('connect_attempt_failed', error);
        throw error;
      })
      .finally(() => {
        this.clearConnectionPromise();
      });

    this.connectionPromise = guardedPromise;

    return guardedPromise;
  }

  private handleMessage(message: WebSocketMessage) {
    if (message.type === 'connected' && message.sessionId) {
      this.sessionId = message.sessionId;
      console.log('Session established:', this.sessionId);
      this.resolveSessionReadyPromise();
    }

    if (message.correlationId) {
      const isTerminal = this.isTerminalCorrelationMessage(message);

      this.notifyCorrelationHandlers(message.correlationId, message);

      if (isTerminal) {
        this.markRequestFulfilled(message.correlationId);
      } else {
        this.refreshPendingCorrelation(message.correlationId);
      }
    } else if (message.type === 'message' && message.role === 'assistant') {
      this.markFirstPendingRequestFulfilled();
    }

    if (message.type === 'pong') {
      return;
    }

    this.notifyHandlers(message.type, message);
  }

  private isTerminalCorrelationMessage(message: WebSocketMessage): boolean {
    const terminalTypes = new Set([
      'message_end',
      'response_end',
      'response_final',
      'stream_end',
    ]);

    if (typeof message.type === 'string' && terminalTypes.has(message.type)) {
      return true;
    }

    const metadata = message.metadata;

    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    const booleanTerminalFlags = [
      (metadata as Record<string, unknown>).isFinal,
      (metadata as Record<string, unknown>).final,
      (metadata as Record<string, unknown>).is_final,
      (metadata as Record<string, unknown>).isTerminal,
      (metadata as Record<string, unknown>).terminal,
      (metadata as Record<string, unknown>).is_terminal,
      (metadata as Record<string, unknown>).done,
      (metadata as Record<string, unknown>).isDone,
      (metadata as Record<string, unknown>).completed,
    ];

    if (booleanTerminalFlags.some((flag) => flag === true)) {
      return true;
    }

    const normalizedMetadata = metadata as Record<string, unknown>;
    const terminalTextFlags = [
      normalizedMetadata.messageType,
      normalizedMetadata.message_type,
      normalizedMetadata.status,
      normalizedMetadata.stage,
      normalizedMetadata.phase,
      normalizedMetadata.event,
      normalizedMetadata.type,
    ]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLowerCase());

    return terminalTextFlags.some((value) =>
      ['final', 'end', 'done', 'complete', 'completed', 'terminal', 'finished', 'stop'].includes(
        value,
      ),
    );
  }

  private notifyHandlers(type: WebSocketMessageType, message: WebSocketMessage) {
    // Handlers específicos do tipo
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // "Handlers genéricos" registrados em 'message' — usados como um tipo de "all events"
    // MAS evitamos chamar de novo quando o próprio tipo já é 'message',
    // pra não duplicar processamento.
    const allHandlers = this.handlers.get('message' as WebSocketMessageType);
    if (allHandlers && type !== 'ping' && type !== 'pong' && type !== 'message') {
      allHandlers.forEach((handler) => handler(message));
    }
  }

  on(type: WebSocketMessageType, handler: WebSocketEventHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  onCorrelation(correlationId: string, handler: WebSocketEventHandler) {
    if (!this.correlationHandlers.has(correlationId)) {
      this.correlationHandlers.set(correlationId, new Set());
    }
    this.correlationHandlers.get(correlationId)!.add(handler);
  }

  offCorrelation(correlationId: string, handler: WebSocketEventHandler) {
    const handlers = this.correlationHandlers.get(correlationId);
    if (!handlers) return;

    handlers.delete(handler);

    if (handlers.size === 0) {
      this.correlationHandlers.delete(correlationId);
    }
  }

  onRequestReplayExhausted(correlationId: string, handler: ReplayFailureHandler) {
    if (!this.replayFailureHandlers.has(correlationId)) {
      this.replayFailureHandlers.set(correlationId, new Set());
    }

    this.replayFailureHandlers.get(correlationId)!.add(handler);
  }

  offRequestReplayExhausted(correlationId: string, handler: ReplayFailureHandler) {
    const handlers = this.replayFailureHandlers.get(correlationId);
    if (!handlers) return;

    handlers.delete(handler);

    if (handlers.size === 0) {
      this.replayFailureHandlers.delete(correlationId);
    }
  }

  off(type: WebSocketMessageType, handler: WebSocketEventHandler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private async ensureConnected(context: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      await this.waitForSessionReady(context, this.sessionReadyTimeoutMs);
      return;
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
      await this.waitForSessionReady(context, this.sessionReadyTimeoutMs);
      return;
    }

    await this.connect();
    await this.waitForSessionReady(context, this.sessionReadyTimeoutMs);
  }

  private getOrCreateSessionReadyPromise() {
    if (!this.sessionReadyPromise) {
      this.resetSessionReadyPromise();
    }

    return {
      promise: this.sessionReadyPromise!,
      version: this.sessionReadyPromiseVersion,
    };
  }

  private async waitForSessionReady(context: string, timeoutMs = 5000) {
    if (this.sessionId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const deadline = Date.now() + timeoutMs;

    while (true) {
      const { promise: sessionReadyPromise, version } = this.getOrCreateSessionReadyPromise();
      const remaining = deadline - Date.now();

      try {
        if (remaining > 0) {
          await Promise.race([
            sessionReadyPromise,
            new Promise<void>((_, reject) => {
              setTimeout(() => reject(new Error('Session handshake timeout')), remaining);
            }),
          ]);
        } else {
          await sessionReadyPromise;
        }
      } catch (error) {
        const isStalePromise = this.sessionReadyPromiseVersion !== version;
        const isReady = this.sessionId && this.ws && this.ws.readyState === WebSocket.OPEN;

        if (isReady) {
          return;
        }

        if (isStalePromise && deadline - Date.now() > 0) {
          continue;
        }

        console.warn('[WebSocketService] Session not ready; aborting send', {
          context,
          sessionId: this.sessionId,
          wsState: this.ws?.readyState,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }

      if (this.sessionId && this.ws && this.ws.readyState === WebSocket.OPEN) {
        return;
      }

      if (this.sessionReadyPromiseVersion !== version && deadline - Date.now() > 0) {
        continue;
      }

      console.warn('[WebSocketService] Session handshake timeout', {
        context,
        sessionId: this.sessionId,
        wsState: this.ws?.readyState,
        timestamp: new Date().toISOString(),
      });
      throw new Error('Session handshake timeout');
    }
  }

  async sendMessage(
    content: string,
    metadata?: any,
    options?: { correlationId?: string; track?: boolean; maxRetries?: number },
  ): Promise<string | void> {
    const shouldTrack = options?.track || Boolean(options?.correlationId);
    const correlationId = options?.correlationId ?? (shouldTrack ? this.generateCorrelationId() : undefined);

    const message: WebSocketMessage = {
      type: 'message',
      content,
      metadata,
      ...(correlationId ? { correlationId } : {}),
    };

    if (shouldTrack && correlationId) {
      const existing = this.requestQueue.get(correlationId);
      const queueEntry: QueuedRequest = existing
        ? {
            ...existing,
            message,
            maxRetries: options?.maxRetries ?? existing.maxRetries,
            expectsCorrelation: true,
            enqueueTimestamp: existing.enqueueTimestamp ?? Date.now(),
            isSending: existing.isSending ?? false,
            hasSentSuccessfully: existing.hasSentSuccessfully ?? false,
          }
        : {
            message,
            attempts: 0,
            maxRetries: options?.maxRetries ?? this.defaultMaxRequestRetries,
            status: 'pending',
            expectsCorrelation: true,
            enqueueTimestamp: Date.now(),
            isSending: false,
            hasSentSuccessfully: false,
          };

      this.requestQueue.set(correlationId, queueEntry);
      this.scheduleRequestTimeout(correlationId);
      await this.sendQueuedRequest(correlationId);
      return correlationId;
    }

    await this.ensureConnected('send_message');

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.sessionId) {
      throw new Error('Unable to establish WebSocket connection');
    }

    this.ws.send(JSON.stringify(message));
  }

  sendTypingStart() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({ type: 'typing_start' }));
  }

  sendTypingStop() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({ type: 'typing_stop' }));
  }

  sendReadReceipt(messageId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: 'read_receipt',
        messageId,
      }),
    );
  }

  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.notifyHandlers('error', {
        type: 'error',
        error: 'Não foi possível reconectar automaticamente. Tente novamente.',
      });
      this.isReconnecting = false;
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000,
    );

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    this.isReconnecting = false;
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.clearConnectionPromise();

    this.sessionId = null;
    this.resetSessionReadyPromise();
  }

  getConnectionState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }

  isReconnectingInProgress(): boolean {
    return this.isReconnecting;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setRequestTimeout(ms: number) {
    this.requestTimeoutMs = ms;
  }
  generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  cancelQueuedRequest(correlationId: string) {
    const entry = this.requestQueue.get(correlationId);
    if (!entry) return;

    this.clearRequestTimeout(entry);
    this.requestQueue.set(correlationId, { ...entry, status: 'canceled' });
    this.requestQueue.delete(correlationId);
    this.replayFailureHandlers.delete(correlationId);
    this.correlationHandlers.delete(correlationId);
  }

  private notifyCorrelationHandlers(correlationId: string, message: WebSocketMessage) {
    const handlers = this.correlationHandlers.get(correlationId);
    if (!handlers) return;

    handlers.forEach((handler) => handler(message));
  }

  private refreshPendingCorrelation(correlationId: string) {
    const entry = this.requestQueue.get(correlationId);
    if (!entry || entry.status !== 'pending') return;

    const refreshedEntry = {
      ...entry,
      enqueueTimestamp: Date.now(),
    } satisfies QueuedRequest;

    this.requestQueue.set(correlationId, refreshedEntry);
    this.scheduleRequestTimeout(correlationId);
  }

  private markRequestFulfilled(correlationId: string) {
    const entry = this.requestQueue.get(correlationId);
    if (!entry) return;

    this.clearRequestTimeout(entry);
    this.requestQueue.set(correlationId, { ...entry, status: 'fulfilled' });
    this.requestQueue.delete(correlationId);
    this.replayFailureHandlers.delete(correlationId);
    this.correlationHandlers.delete(correlationId);
  }

  private markFirstPendingRequestFulfilled() {
    const pendingEntry = Array.from(this.requestQueue.entries()).find(([, entry]) => {
      return entry.status === 'pending' && !entry.expectsCorrelation;
    });

    if (!pendingEntry) return;

    const [correlationId] = pendingEntry;
    this.markRequestFulfilled(correlationId);
  }

  private async sendQueuedRequest(
    correlationId: string,
    options: { isExplicitRetry?: boolean } = {},
  ) {
    const entry = this.requestQueue.get(correlationId);
    if (!entry || entry.status !== 'pending') {
      return;
    }

    if (entry.isSending) {
      return;
    }

    const { isExplicitRetry = false } = options;
    const shouldIncrementForRetry = isExplicitRetry && !entry.hasSentSuccessfully;

    const updatedEntry: QueuedRequest = {
      ...entry,
      isSending: true,
      attempts: shouldIncrementForRetry ? entry.attempts + 1 : entry.attempts,
      hasSentSuccessfully: entry.hasSentSuccessfully ?? false,
    };

    if (updatedEntry.attempts >= updatedEntry.maxRetries) {
      this.requestQueue.set(correlationId, { ...updatedEntry, isSending: false });
      this.failQueuedRequest(correlationId);
      return;
    }

    this.requestQueue.set(correlationId, updatedEntry);

    try {
      await this.ensureConnected('send_queued_request');
      await this.waitForSessionReady('send_queued_request', this.sessionReadyTimeoutMs);

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.sessionId) {
        throw new Error('Unable to establish WebSocket connection');
      }

      this.ws.send(JSON.stringify(updatedEntry.message));

      const refreshedEntry = this.requestQueue.get(correlationId);
      if (refreshedEntry && refreshedEntry.status === 'pending') {
        this.requestQueue.set(correlationId, {
          ...refreshedEntry,
          attempts: 0,
          isSending: false,
          hasSentSuccessfully: true,
        });
        this.scheduleRequestTimeout(correlationId);
      }
    } catch (error) {
      const failedEntry = this.requestQueue.get(correlationId);
      if (failedEntry && failedEntry.status === 'pending') {
        const alreadyIncremented = shouldIncrementForRetry;
        const nextAttempts = failedEntry.hasSentSuccessfully
          ? failedEntry.attempts
          : failedEntry.attempts + (alreadyIncremented ? 0 : 1);

        const retryCandidate: QueuedRequest = {
          ...failedEntry,
          attempts: nextAttempts,
          isSending: false,
          hasSentSuccessfully: failedEntry.hasSentSuccessfully,
        };

        this.requestQueue.set(correlationId, retryCandidate);

        if (retryCandidate.attempts >= retryCandidate.maxRetries) {
          this.failQueuedRequest(correlationId);
        }
      }

      throw error;
    }
  }

  private async replayPendingRequests() {
    if (this.requestQueue.size === 0) return;

    await this.waitForSessionReady('replay_pending_requests', this.sessionReadyTimeoutMs);

    for (const correlationId of this.requestQueue.keys()) {
      const entry = this.requestQueue.get(correlationId);
      if (!entry || entry.status !== 'pending' || entry.isSending) continue;

      await this.sendQueuedRequest(correlationId, { isExplicitRetry: true });
    }
  }

  private failQueuedRequest(correlationId: string) {
    const entry = this.requestQueue.get(correlationId);
    if (!entry) return;

    this.clearRequestTimeout(entry);
    this.requestQueue.set(correlationId, { ...entry, status: 'failed' });
    this.notifyReplayExhausted(correlationId);
    this.requestQueue.delete(correlationId);
    this.correlationHandlers.delete(correlationId);
  }

  private notifyReplayExhausted(correlationId: string) {
    const handlers = this.replayFailureHandlers.get(correlationId);
    if (!handlers) return;

    handlers.forEach((handler) => handler(correlationId));
    this.replayFailureHandlers.delete(correlationId);
  }

  private scheduleRequestTimeout(correlationId: string) {
    const entry = this.requestQueue.get(correlationId);
    if (!entry || entry.status !== 'pending') return;

    this.clearRequestTimeout(entry);

    const elapsed = Date.now() - entry.enqueueTimestamp;
    const remainingWindow = this.requestTimeoutMs - elapsed;

    if (remainingWindow <= 0) {
      this.handleRequestTimeout(correlationId);
      return;
    }

    const timeoutId = setTimeout(() => {
      this.handleRequestTimeout(correlationId);
    }, remainingWindow);

    this.requestQueue.set(correlationId, { ...entry, timeoutId });
  }

  private clearRequestTimeout(entry?: QueuedRequest) {
    if (entry?.timeoutId) {
      clearTimeout(entry.timeoutId);
      entry.timeoutId = undefined;
    }
  }

  private handleRequestTimeout(correlationId: string) {
    const entry = this.requestQueue.get(correlationId);
    if (!entry || entry.status !== 'pending') return;

    this.failQueuedRequest(correlationId);
  }
}

const runtimeEnv =
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env) ||
  (typeof process !== 'undefined' ? process.env : undefined);

const isDev =
  runtimeEnv?.DEV === true ||
  runtimeEnv?.DEV === 'true' ||
  runtimeEnv?.NODE_ENV === 'development';

const wsUrl = isDev
  ? 'ws://localhost:8080/ws'
  : typeof window !== 'undefined'
    ? `wss://${window.location.host}/ws`
    : 'wss://localhost/ws';

export const websocketService = new WebSocketService(wsUrl);
