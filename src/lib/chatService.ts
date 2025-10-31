import { getStoredWixToken } from './wixAuthService';

const WEBHOOK_URL = 'https://brian-jado.app.n8n.cloud/webhook/1475aa73-fde6-481b-9a13-58d50ac83b41/chat';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  contentType?: 'text' | 'trends' | 'topics' | 'summary';
  structuredData?: any;
  metadata?: {
    trendId?: string;
    trendName?: string;
    topicId?: string;
    topicName?: string;
  };
};

export type SendMessageParams = {
  message: string;
  userEmail: string;
  authToken?: string;
};

export type SendMessageResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

export async function sendMessageToAgent(params: SendMessageParams): Promise<SendMessageResponse> {
  try {
    const wixUser = getStoredWixToken();
    const authToken = params.authToken || wixUser?.token;

    const payload = [
      {
        event: 'messages.upsert',
        data: {
          key: {
            remoteJid: `web:${params.userEmail}`
          },
          web: params.userEmail,
          telegram: null,
          message: {
            conversation: params.message
          }
        },
        date_time: new Date().toISOString(),
        source: 'web-app'
      }
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      data
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Tempo esgotado. Por favor, tente novamente.'
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
    return {
      success: false,
      error: 'Ocorreu um erro inesperado'
    };
  }
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
