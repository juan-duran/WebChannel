import { supabase } from './supabase';
import { TapNavigationStructuredData } from '../types/tapNavigation';

const WEBHOOK_URL = 'https://brian-jado.app.n8n.cloud/webhook/1475aa73-fde6-481b-9a13-58d50ac83b41/chat';

async function logAuditMessage(userId: string, direction: 'in' | 'out', payload: any): Promise<void> {
  try {
    await supabase
      .from('web_messages')
      .insert({
        user_id: userId,
        direction,
        payload
      });
  } catch (error) {
    console.error('Failed to log audit message:', error);
  }
}

export type MessageButton = {
  label: string;
  value: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  contentType?: 'text' | 'trends' | 'topics' | 'summary';
  structuredData?: TapNavigationStructuredData | Record<string, any> | Array<Record<string, any>> | null;
  metadata?: {
    trendId?: string;
    trendName?: string;
    topicId?: string;
    topicName?: string;
    [key: string]: any;
  };
  buttons?: MessageButton[];
};

export type SendMessageParams = {
  message: string;
  channelId: string;
  userId: string;
};

export type SendMessageResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

export async function sendMessageToAgent(params: SendMessageParams): Promise<SendMessageResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      throw new Error('User not authenticated');
    }

    const requestPayload = {
      action: params.message.startsWith('Assunto #') ? 'get_topicos' :
              params.message.startsWith('Tópico #') ? 'get_resumo' :
              params.message === 'assuntos' ? 'get_assuntos' : 'chat',
      message: params.message
    };

    await logAuditMessage(params.userId, 'in', requestPayload);

    const payload = [
      {
        event: 'messages.upsert',
        data: {
          key: {
            remoteJid: `web:${userEmail}`
          },
          web: userEmail,
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

    await logAuditMessage(params.userId, 'out', {
      response: data,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      data
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout. Please try again.'
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
    return {
      success: false,
      error: 'An unexpected error occurred'
    };
  }
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function saveMessageToDatabase(
  channelId: string,
  userId: string | null,
  role: 'user' | 'assistant',
  content: string,
  contentType: string = 'text',
  structuredData?: TapNavigationStructuredData | Record<string, any> | Array<Record<string, any>> | null,
  metadata?: any,
  webhookResponse?: any,
  correlationId?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: channelId,
        user_id: userId,
        role,
        content,
        content_type: contentType,
        structured_data: structuredData,
        metadata,
        webhook_response: webhookResponse,
        status: 'sent',
        correlation_id: correlationId
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Failed to save message to database:', error);
    return null;
  }
}

export async function loadMessagesFromDatabase(
  channelId: string,
  limit: number = 100
): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return data.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at),
      status: msg.status as 'sending' | 'sent' | 'error',
      contentType: msg.content_type as 'text' | 'trends' | 'topics' | 'summary',
      structuredData: (msg.structured_data as any) ?? null,
      metadata: msg.metadata,
      buttons: Array.isArray((msg as any).buttons)
        ? (msg as any).buttons.filter(
            (button: any): button is MessageButton =>
              button && typeof button.label === 'string' && typeof button.value === 'string'
          )
        : undefined,
    }));
  } catch (error) {
    console.error('Failed to load messages from database:', error);
    return [];
  }
}

export async function getOrCreateDefaultChannel(userId: string): Promise<string | null> {
  try {
    const { data: membership } = await supabase
      .from('channel_members')
      .select('channel_id, channels(id, name, is_default)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (membership && membership.channel_id) {
      return membership.channel_id;
    }

    const { data: defaultChannel } = await supabase
      .from('channels')
      .select('id')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    if (defaultChannel) {
      const { error: joinError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: defaultChannel.id,
          user_id: userId,
          role: 'member'
        });

      if (!joinError) {
        return defaultChannel.id;
      }
    }

    const { data: newChannel, error: createError } = await supabase
      .from('channels')
      .insert({
        name: 'General',
        description: 'Default chat channel',
        created_by: userId,
        is_default: true
      })
      .select('id')
      .single();

    if (createError) throw createError;

    await supabase
      .from('channel_members')
      .insert({
        channel_id: newChannel.id,
        user_id: userId,
        role: 'admin'
      });

    return newChannel.id;
  } catch (error) {
    console.error('Failed to get or create default channel:', error);
    return null;
  }
}
