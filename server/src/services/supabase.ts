import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class SupabaseService {
  public client: SupabaseClient;

  constructor() {
    this.client = createClient(
      config.supabase.url,
      config.supabase.serviceKey || config.supabase.anonKey
    );
    logger.info('Supabase client initialized');
  }

  async verifyAuthToken(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      const { data, error } = await this.client.auth.getUser(token);

      if (error || !data.user) {
        logger.warn({ error: error?.message }, 'Invalid auth token');
        return null;
      }

      return {
        userId: data.user.id,
        email: data.user.email || '',
      };
    } catch (error) {
      logger.error({ error }, 'Error verifying auth token');
      return null;
    }
  }

  async logAuditMessage(userId: string, direction: 'in' | 'out', payload: any): Promise<void> {
    try {
      await this.client
        .from('web_messages')
        .insert({
          user_id: userId,
          direction,
          payload,
        });
    } catch (error) {
      logger.error({ error, userId, direction }, 'Failed to log audit message');
    }
  }

  async saveMessage(
    channelId: string,
    userId: string | null,
    role: 'user' | 'assistant',
    content: string,
    contentType: string = 'text',
    structuredData?: any,
    metadata?: any,
    webhookResponse?: any,
    mediaUrl?: string,
    mediaType?: string,
    mediaCaption?: string
  ): Promise<string | null> {
    try {
      const { data, error } = await this.client
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
          media_url: mediaUrl,
          media_type: mediaType,
          media_caption: mediaCaption,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      logger.error({ error, channelId, role }, 'Failed to save message to database');
      return null;
    }
  }

  async getOrCreateDefaultChannel(userId: string): Promise<string | null> {
    try {
      const { data: membership } = await this.client
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (membership?.channel_id) {
        return membership.channel_id;
      }

      const { data: defaultChannel } = await this.client
        .from('channels')
        .select('id')
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();

      if (defaultChannel) {
        const { error: joinError } = await this.client
          .from('channel_members')
          .insert({
            channel_id: defaultChannel.id,
            user_id: userId,
            role: 'member',
          });

        if (!joinError) {
          return defaultChannel.id;
        }
      }

      const { data: newChannel, error: createError } = await this.client
        .from('channels')
        .insert({
          name: 'General',
          description: 'Default chat channel',
          created_by: userId,
          is_default: true,
        })
        .select('id')
        .single();

      if (createError) throw createError;

      await this.client
        .from('channel_members')
        .insert({
          channel_id: newChannel.id,
          user_id: userId,
          role: 'admin',
        });

      return newChannel.id;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get or create default channel');
      return null;
    }
  }

  async logCacheInvalidation(keyPrefix: string, invalidatedBy: string, reason?: string): Promise<void> {
    try {
      await this.client
        .from('cache_invalidations')
        .insert({
          key_prefix: keyPrefix,
          invalidated_by: invalidatedBy,
          reason,
        });
    } catch (error) {
      logger.error({ error, keyPrefix }, 'Failed to log cache invalidation');
    }
  }
}

export const supabaseService = new SupabaseService();
