import fetch from 'node-fetch';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { N8nWebhookPayload } from '../types/index.js';
import { cacheService } from './cache.js';
import { hashEmail } from '../utils/crypto.js';

export class N8nService {
  private retryDelays = [1000, 2000, 4000];

  async sendMessage(
    userEmail: string,
    message: string,
    sessionId: string,
    correlationId: string,
    userId: string
  ): Promise<any> {
    const isCacheable = this.isCacheableRequest(message);

    if (isCacheable) {
      const { kind, params } = this.getCacheParams(message, userEmail, userId);

      return await cacheService.fetchWithCache(
        kind,
        params,
        () => this.callWebhook(userEmail, message, sessionId, correlationId)
      );
    }

    return await this.callWebhook(userEmail, message, sessionId, correlationId);
  }

  private isCacheableRequest(message: string): boolean {
    if (message === 'assuntos') return true;
    if (message.match(/^Assunto #\d+$/)) return true;
    if (message.match(/^Tópico #\d+$/)) return true;
    return false;
  }

  private getCacheParams(message: string, userEmail: string, userId: string): {
    kind: 'trends' | 'topics' | 'summary';
    params: Record<string, string>
  } {
    const today = new Date().toISOString().slice(0, 10);

    if (message === 'assuntos') {
      return {
        kind: 'trends',
        params: { d: today },
      };
    }

    const trendMatch = message.match(/^Assunto #(\d+)$/);
    if (trendMatch) {
      return {
        kind: 'topics',
        params: { trend_id: trendMatch[1], d: today },
      };
    }

    const topicMatch = message.match(/^Tópico #(\d+)$/);
    if (topicMatch) {
      const emailHash = hashEmail(userEmail);
      return {
        kind: 'summary',
        params: { topic_id: topicMatch[1], uid: emailHash, d: today },
      };
    }

    return {
      kind: 'trends',
      params: { d: today },
    };
  }

  private async callWebhook(
    userEmail: string,
    message: string,
    sessionId: string,
    correlationId: string
  ): Promise<any> {
    const payload: N8nWebhookPayload = {
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: `web:${userEmail}`,
        },
        web: userEmail,
        telegram: null,
        message: {
          conversation: message,
        },
      },
      date_time: new Date().toISOString(),
      source: 'web-app',
      session_id: sessionId,
      correlation_id: correlationId,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.n8n.retryAttempts; attempt++) {
      try {
        logger.info({ correlationId, attempt, message: message.substring(0, 50) }, 'Calling n8n webhook');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.n8n.webhookTimeout);

        const response = await fetch(config.n8n.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([payload]),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        logger.info({ correlationId, attempt }, 'n8n webhook call successful');
        return data;

      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError') {
          logger.warn({ correlationId, attempt }, 'n8n webhook timeout');
        } else {
          logger.warn({ correlationId, attempt, error: error.message }, 'n8n webhook call failed');
        }

        if (attempt < config.n8n.retryAttempts) {
          const delay = this.retryDelays[attempt] || 4000;
          logger.info({ correlationId, attempt, delay }, 'Retrying n8n webhook call');
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Failed to call n8n webhook after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const n8nService = new N8nService();
