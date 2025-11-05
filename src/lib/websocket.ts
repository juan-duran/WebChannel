import { supabase } from './supabase';

export type WebSocketMessageType = 'connected' | 'message' | 'typing_start' | 'typing_stop' | 'error' | 'ping' | 'pong';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  sessionId?: string;
  correlationId?: string;
  role?: 'user' | 'assistant';
  content?: string;
  contentType?: 'text' | 'image' | 'video' | 'link' | 'trends' | 'topics' | 'summary';
  structuredData?: any;
  metadata?: any;
  mediaUrl?: string;
  mediaType?: string;
  mediaCaption?: string;
  cacheTag?: string;
  webhookResponse?: any;
  message?: string;
  error?: string;
  messageId?: string;
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

  constructor(private wsUrl: string) {}

  async connect(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const token = session.access_token;
    const url = `${this.wsUrl}?token=${encodeURIComponent(token)}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.startHeartbeat();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.stopHeartbeat();
        this.notifyHandlers('error', { type: 'error', error: 'Connection closed' });

        if (!this.isIntentionallyClosed) {
          this.attemptReconnect();
        }
      };
    });
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
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }

    const allHandlers = this.handlers.get('message' as WebSocketMessageType);
    if (allHandlers && type !== 'ping' && type !== 'pong') {
      allHandlers.forEach(handler => handler(message));
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

  sendMessage(content: string, metadata?: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
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

    this.ws.send(JSON.stringify({
      type: 'read_receipt',
      messageId,
    }));
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
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(error => {
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
