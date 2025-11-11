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

export class WebSocketService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private handlers: Map<WebSocketMessageType, Set<WebSocketEventHandler>> = new Map();
  private isIntentionallyClosed = false;
  private heartbeatInterval: number | null = null;
  private connectionPromise: Promise<void> | null = null;

  constructor(private wsUrl: string) {}

  private clearConnectionPromise() {
    this.connectionPromise = null;
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

    const connectionPromise = (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const token = session.access_token;
      const url = `${this.wsUrl}?token=${encodeURIComponent(token)}`;

      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(url);
        this.ws = ws;
        let isOpen = false;

        ws.onopen = () => {
          isOpen = true;
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.startHeartbeat();
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

          this.notifyHandlers('error', {
            type: 'error',
            error: event instanceof ErrorEvent ? event.message : 'Connection error',
          });

          if (!isOpen) {
            reject(error);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket closed');
          this.stopHeartbeat();
          this.notifyHandlers('error', { type: 'error', error: 'Connection closed' });
          this.ws = null;

          if (!isOpen) {
            const error = this.isIntentionallyClosed
              ? new Error('WebSocket connection intentionally closed')
              : new Error('WebSocket connection closed before opening');
            reject(error);
          }

          if (!this.isIntentionallyClosed) {
            this.attemptReconnect();
          }
        };
      });
    })();

    const guardedPromise = connectionPromise.finally(() => {
      this.clearConnectionPromise();
    });

    this.connectionPromise = guardedPromise;

    return guardedPromise;
  }

  private handleMessage(message: WebSocketMessage) {
    if (message.type === 'connected' && message.sessionId) {
      this.sessionId = message.sessionId;
      console.log('Session established:', this.sessionId);
    }

    if (message.type === 'pong') {
      return;
    }

    this.notifyHandlers(message.type, message);
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

  off(type: WebSocketMessageType, handler: WebSocketEventHandler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private async ensureConnected() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
      return;
    }

    await this.connect();
  }

  async sendMessage(content: string, metadata?: any) {
    await this.ensureConnected();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Unable to establish WebSocket connection');
    }

    const message: WebSocketMessage = {
      type: 'message',
      content,
      metadata,
    };

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
      return;
    }

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
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.clearConnectionPromise();

    this.sessionId = null;
    this.handlers.clear();
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

  getSessionId(): string | null {
    return this.sessionId;
  }
}

const wsUrl = import.meta.env.DEV
  ? 'ws://localhost:8080/ws'
  : `wss://${window.location.host}/ws`;

export const websocketService = new WebSocketService(wsUrl);
