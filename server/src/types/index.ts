import { WebSocket } from 'ws';

export interface SessionData {
  sessionId: string;
  userId: string;
  userEmail: string;
  ws: WebSocket;
  connectedAt: Date;
  lastHeartbeat: Date;
  metadata?: Record<string, any>;
}

export interface CacheEntry {
  at: number;
  data: any;
}

export interface WebSocketMessage {
  type: 'message' | 'typing_start' | 'typing_stop' | 'read_receipt' | 'ping' | 'pong';
  correlationId?: string;
  content?: string;
  messageId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface N8nWebhookPayload {
  event: string;
  data: {
    key: {
      remoteJid: string;
    };
    web: string;
    telegram: null;
    message: {
      conversation: string;
    };
  };
  date_time: string;
  source: string;
  session_id?: string;
  correlation_id?: string;
}

export interface OutgoingMessageRequest {
  sessionId?: string;
  userId?: string;
  userEmail?: string;
  content: string;
  contentType?: 'text' | 'image' | 'video' | 'link' | 'trends' | 'topics' | 'summary';
  structuredData?: any;
  metadata?: any;
  mediaUrl?: string;
  mediaType?: string;
  mediaCaption?: string;
  cacheTag?: string;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  inflight: number;
  entries: number;
  evictions: number;
}

export type CacheKind = 'trends' | 'topics' | 'summary';
