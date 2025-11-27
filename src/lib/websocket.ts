import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { TapNavigationStructuredData } from '../types/tapNavigation';

const envSource =
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env) ||
  (typeof process !== 'undefined' ? process.env : undefined);

const coreSupabaseUrl = envSource?.VITE_CORE_SUPABASE_URL;
const coreSupabaseAnonKey = envSource?.VITE_CORE_SUPABASE_ANON_KEY;

if (!coreSupabaseUrl || !coreSupabaseAnonKey) {
  throw new Error('Missing Supabase realtime environment variables');
}

const realtimeClient = createClient(coreSupabaseUrl, coreSupabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
  private realtimeChannel: RealtimeChannel | null = null;
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
  private channelReadyPromise: Promise<void> | null = null;
  private resolveChannelReady: (() => void) | null = null;
  private channelReadyPromiseVersion = 0;
  private isReconnecting = false;
  private readonly defaultMaxRequestRetries = 3;
  private requestTimeoutMs = 120000;
  private channelReadyTimeoutMs = 10000;

  constructor(private channelTopic: string) {}

  private clearConnectionPromise() {
    this.connectionPromise = null;
  }

  private resetChannelReadyPromise() {
    this.resolveChannelReady = null;

    const version = ++this.channelReadyPromiseVersion;
    const readyPromise = new Promise<void>((resolve) => {
      this.resolveChannelReady = () => {
        if (this.channelReadyPromiseVersion === version) {
          resolve();
          this.resolveChannelReady = null;
        }
      };
    });

    this.channelReadyPromise = readyPromise;
  }

  private resolveChannelReadyPromise() {
    if (this.resolveChannelReady) {
      this.resolveChannelReady();
      this.resolveChannelReady = null;
    }

    if (!this.channelReadyPromise) {
      this.resetChannelReadyPromise();
    }
  }

  private logConnectionFailure(reason: string, error?: unknown) {
    const baseError = error instanceof Error ? { message: error.message, stack: error.stack } : { error };
    console.error('[WebSocketService][ConnectionFailure]', {
      event: 'websocket_connection_failure',
      reason,
      reconnectAttempts: this.reconnectAttempts,
      timestamp: new Date().toISOString(),
      ...baseError,
    });
  }

  private logConnectionBreadcrumb(event: string, payload?: Record<string, unknown>) {
    console.log('[WebSocketService]', {
      event,
      timestamp: new Date().toISOString(),
      ...(payload ?? {}),
    });
  }

  async connect(): Promise<void> {
    if (this.realtimeChannel?.state === 'joined') {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isIntentionallyClosed = false;
    this.resetChannelReadyPromise();

    const connectionPromise = (async () => {
      if (this.realtimeChannel) {
        await this.realtimeChannel.unsubscribe();
      }

      const channel = realtimeClient.channel(this.channelTopic);
      this.realtimeChannel = channel;

      channel.on('broadcast', {}, (payload) => {
        try {
          this.handleMessage(payload.payload as WebSocketMessage);
        } catch (error) {
          console.error('Error parsing realtime payload:', error);
        }
      });

      await new Promise<void>((resolve, reject) => {
        channel.subscribe((status, error) => {
          if (status === 'SUBSCRIBED') {
            const wasReconnecting = this.isReconnecting || this.reconnectAttempts > 0;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            this.isReconnecting = false;
            this.startHeartbeat();
            this.resolveChannelReadyPromise();
            if (wasReconnecting) {
              this.replayPendingRequests();
            }
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            this.logConnectionFailure('realtime_connect_failed', error);
            reject(error ?? new Error('Realtime connection failed'));
          } else if (status === 'CLOSED') {
            this.stopHeartbeat();
            if (!this.isIntentionallyClosed) {
              this.attemptReconnect();
            }
          }
        });
      });
    })();

    const guardedPromise = connectionPromise
      .catch((error) => {
        this.logConnectionFailure('realtime_connect_failed', error);
        throw error;
      })
      .finally(() => {
        this.clearConnectionPromise();
      });

    this.connectionPromise = guardedPromise;

    return guardedPromise;
  }

  private handleMessage(message: WebSocketMessage) {
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
    if (this.realtimeChannel && this.realtimeChannel.state === 'joined') {
      await this.waitForChannelReady(context, this.channelReadyTimeoutMs);
      return;
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
      await this.waitForChannelReady(context, this.channelReadyTimeoutMs);
      return;
    }

    await this.connect();
    await this.waitForChannelReady(context, this.channelReadyTimeoutMs);
  }

  private getOrCreateChannelReadyPromise() {
    if (!this.channelReadyPromise) {
      this.resetChannelReadyPromise();
    }

    return {
      promise: this.channelReadyPromise!,
      version: this.channelReadyPromiseVersion,
    };
  }

  private async waitForChannelReady(context: string, timeoutMs = 5000) {
    if (this.realtimeChannel && this.realtimeChannel.state === 'joined') {
      return;
    }

    const deadline = Date.now() + timeoutMs;

    while (true) {
      const { promise: channelReadyPromise, version } = this.getOrCreateChannelReadyPromise();
      const remaining = deadline - Date.now();

      try {
        if (remaining > 0) {
          await Promise.race([
            channelReadyPromise,
            new Promise<void>((_, reject) => {
              setTimeout(() => reject(new Error('Realtime channel timeout')), remaining);
            }),
          ]);
        } else {
          await channelReadyPromise;
        }
      } catch (error) {
        const isStalePromise = this.channelReadyPromiseVersion !== version;
        const isReady = this.realtimeChannel && this.realtimeChannel.state === 'joined';

        if (isReady) {
          return;
        }

        if (isStalePromise && deadline - Date.now() > 0) {
          continue;
        }

        console.warn('[WebSocketService] Realtime channel not ready; aborting send', {
          context,
          channelState: this.realtimeChannel?.state,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }

      if (this.realtimeChannel && this.realtimeChannel.state === 'joined') {
        return;
      }

      if (this.channelReadyPromiseVersion !== version && deadline - Date.now() > 0) {
        continue;
      }

      console.warn('[WebSocketService] Realtime channel timeout', {
        context,
        channelState: this.realtimeChannel?.state,
        timestamp: new Date().toISOString(),
      });
      throw new Error('Realtime channel timeout');
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

    if (!this.realtimeChannel || this.realtimeChannel.state !== 'joined') {
      throw new Error('Unable to establish realtime connection');
    }

    const sent = await this.realtimeChannel.send({
      type: 'broadcast',
      event: 'message',
      payload: message,
    });

    if (!sent) {
      throw new Error('Failed to send message over realtime channel');
    }
  }

  sendTypingStart() {
    if (!this.realtimeChannel || this.realtimeChannel.state !== 'joined') return;

    this.realtimeChannel.send({ type: 'broadcast', event: 'typing_start', payload: { type: 'typing_start' } });
  }

  sendTypingStop() {
    if (!this.realtimeChannel || this.realtimeChannel.state !== 'joined') return;

    this.realtimeChannel.send({ type: 'broadcast', event: 'typing_stop', payload: { type: 'typing_stop' } });
  }

  sendReadReceipt(messageId: string) {
    if (!this.realtimeChannel || this.realtimeChannel.state !== 'joined') return;

    this.realtimeChannel.send({
      type: 'broadcast',
      event: 'read_receipt',
      payload: { type: 'read_receipt', messageId },
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.realtimeChannel && this.realtimeChannel.state === 'joined') {
        this.realtimeChannel.send({ type: 'broadcast', event: 'ping', payload: { type: 'ping' } });
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

    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }

    this.clearConnectionPromise();
    this.resetChannelReadyPromise();
  }

  getConnectionState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (!this.realtimeChannel) return 'disconnected';

    switch (this.realtimeChannel.state) {
      case 'joining':
        return 'connecting';
      case 'joined':
        return 'connected';
      case 'closed':
      case 'leaving':
        return 'disconnected';
      case 'errored':
        return 'error';
      default:
        return 'connecting';
    }
  }

  isReconnectingInProgress(): boolean {
    return this.isReconnecting;
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
      await this.waitForChannelReady('send_queued_request', this.channelReadyTimeoutMs);

      if (!this.realtimeChannel || this.realtimeChannel.state !== 'joined') {
        throw new Error('Unable to establish realtime connection');
      }

      const sent = await this.realtimeChannel.send({
        type: 'broadcast',
        event: 'message',
        payload: updatedEntry.message,
      });

      if (!sent) {
        throw new Error('Failed to send message over realtime channel');
      }

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

    await this.waitForChannelReady('replay_pending_requests', this.channelReadyTimeoutMs);

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
const channelTopic = envSource?.VITE_REALTIME_CHANNEL ?? 'websocket';

export const websocketService = new WebSocketService(channelTopic);
