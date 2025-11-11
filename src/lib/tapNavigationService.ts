import { websocketService, type WebSocketMessage } from './websocket';
import { cacheStorage } from './cacheStorage';
import {
  TrendData,
  TopicData,
  SummaryData,
  TapNavigationStructuredData,
} from '../types/tapNavigation';

class StructuredDataValidationError extends Error {
  constructor(message = 'O assistente retornou dados inválidos.') {
    super(message);
    this.name = 'StructuredDataValidationError';
  }
}

class RequestTimeoutError extends Error {
  constructor(message = 'Tempo limite ao aguardar resposta do assistente.') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

export interface TapNavigationResponse {
  success: boolean;
  data?: TrendData[] | TopicData[] | SummaryData;
  fromCache?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

class TapNavigationService {
  private pendingRequests = new Map<string, Promise<TapNavigationResponse>>();

  async fetchTrends(options?: { forceRefresh?: boolean }): Promise<TapNavigationResponse> {
    const cacheKey = 'trends';

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const promise = this.fetchTrendsInternal(options);
    this.pendingRequests.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async fetchTrendsInternal(options?: { forceRefresh?: boolean }): Promise<TapNavigationResponse> {
    try {
      const cached = await cacheStorage.getTrends();

      if (cached && !options?.forceRefresh) {
        if (cacheStorage.isStale(cached)) {
          this.refreshTrendsInBackground();
        }

        return {
          success: true,
          data: cached.data,
          fromCache: true,
        };
      }

      const payload = await this.requestFromAgent('assuntos');

      if (Array.isArray(payload.trends)) {
        await cacheStorage.setTrends(payload.trends as TrendData[]);
        return {
          success: true,
          data: payload.trends as TrendData[],
          fromCache: false,
          metadata: payload.metadata ?? undefined,
        };
      }

      const invalidDataMessage = 'O assistente não retornou tendências válidas.';

      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
          error: `${invalidDataMessage} Exibindo dados em cache.`,
        };
      }

      return {
        success: false,
        error: invalidDataMessage,
      };
    } catch (error) {
      console.error('Error fetching trends:', error);

      const cached = await cacheStorage.getTrends();
      if (cached) {
        const errorMessage = this.formatErrorMessage(error, 'Não foi possível carregar os assuntos.');
        return {
          success: true,
          data: cached.data,
          fromCache: true,
          error: `${errorMessage} Exibindo dados em cache.`,
        };
      }

      return {
        success: false,
        error: this.formatErrorMessage(error, 'Não foi possível carregar os assuntos.'),
      };
    }
  }

  private async refreshTrendsInBackground(): Promise<void> {
    try {
      const payload = await this.requestFromAgent('assuntos');
      if (Array.isArray(payload.trends)) {
        await cacheStorage.setTrends(payload.trends as TrendData[]);
      }
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }

  async fetchTopics(trendRank: number, options?: { forceRefresh?: boolean }): Promise<TapNavigationResponse> {
    const cacheKey = `topics_${trendRank}`;

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const promise = this.fetchTopicsInternal(trendRank, options);
    this.pendingRequests.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async fetchTopicsInternal(trendRank: number, options?: { forceRefresh?: boolean }): Promise<TapNavigationResponse> {
    try {
      const cached = await cacheStorage.getTopics(trendRank);

      if (cached && !options?.forceRefresh) {
        if (cacheStorage.isStale(cached)) {
          this.refreshTopicsInBackground(trendRank);
        }

        return {
          success: true,
          data: cached.data,
          fromCache: true,
        };
      }

      const payload = await this.requestFromAgent(`Assunto #${trendRank}`);

      if (Array.isArray(payload.topics)) {
        await cacheStorage.setTopics(trendRank, payload.topics as TopicData[]);
        return {
          success: true,
          data: payload.topics as TopicData[],
          fromCache: false,
          metadata: payload.metadata ?? undefined,
        };
      }

      const invalidDataMessage = 'O assistente não retornou tópicos válidos.';

      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
          error: `${invalidDataMessage} Exibindo dados em cache.`,
        };
      }

      return {
        success: false,
        error: invalidDataMessage,
      };
    } catch (error) {
      console.error('Error fetching topics:', error);

      const cached = await cacheStorage.getTopics(trendRank);
      if (cached) {
        const errorMessage = this.formatErrorMessage(error, 'Não foi possível carregar os tópicos.');
        return {
          success: true,
          data: cached.data,
          fromCache: true,
          error: `${errorMessage} Exibindo dados em cache.`,
        };
      }

      return {
        success: false,
        error: this.formatErrorMessage(error, 'Não foi possível carregar os tópicos.'),
      };
    }
  }

  private async refreshTopicsInBackground(trendRank: number): Promise<void> {
    try {
      const payload = await this.requestFromAgent(`Assunto #${trendRank}`);
      if (Array.isArray(payload.topics)) {
        await cacheStorage.setTopics(trendRank, payload.topics as TopicData[]);
      }
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }

  async fetchSummary(topicRank: number, userId: string, options?: { forceRefresh?: boolean }): Promise<TapNavigationResponse> {
    const cacheKey = `summary_${topicRank}_${userId}`;

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const promise = this.fetchSummaryInternal(topicRank, userId, options);
    this.pendingRequests.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async fetchSummaryInternal(topicRank: number, userId: string, options?: { forceRefresh?: boolean }): Promise<TapNavigationResponse> {
    try {
      const cached = await cacheStorage.getSummary(topicRank, userId);

      if (cached && !options?.forceRefresh) {
        if (cacheStorage.isStale(cached)) {
          this.refreshSummaryInBackground(topicRank, userId);
        }

        return {
          success: true,
          data: cached.data,
          fromCache: true,
        };
      }

      const payload = await this.requestFromAgent(`Tópico #${topicRank}`);

      if (payload.summary) {
        await cacheStorage.setSummary(topicRank, userId, payload.summary as SummaryData);
        return {
          success: true,
          data: payload.summary as SummaryData,
          fromCache: false,
          metadata: payload.metadata ?? undefined,
        };
      }

      const invalidDataMessage = 'O assistente não retornou um resumo válido.';

      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
          error: `${invalidDataMessage} Exibindo dados em cache.`,
        };
      }

      return {
        success: false,
        error: invalidDataMessage,
      };
    } catch (error) {
      console.error('Error fetching summary:', error);

      const cached = await cacheStorage.getSummary(topicRank, userId);
      if (cached) {
        const errorMessage = this.formatErrorMessage(error, 'Não foi possível carregar o resumo.');
        return {
          success: true,
          data: cached.data,
          fromCache: true,
          error: `${errorMessage} Exibindo dados em cache.`,
        };
      }

      return {
        success: false,
        error: this.formatErrorMessage(error, 'Não foi possível carregar o resumo.'),
      };
    }
  }

  private async refreshSummaryInBackground(topicRank: number, userId: string): Promise<void> {
    try {
      const payload = await this.requestFromAgent(`Tópico #${topicRank}`);
      if (payload.summary) {
        await cacheStorage.setSummary(topicRank, userId, payload.summary as SummaryData);
      }
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }

  private async requestFromAgent(message: string): Promise<TapNavigationStructuredData> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      const handleMessage = (response: WebSocketMessage) => {
        if (resolved) return;

        if (response.type === 'message' && response.role === 'assistant') {
          resolved = true;
          clearTimeout(timeout);

          clearListeners();

          if (response.structuredData && this.isValidStructuredData(response.structuredData)) {
            resolve(this.normalizeStructuredData(response.structuredData));
          } else {
            reject(new StructuredDataValidationError());
          }
        }
      };

      const handleError = (error: WebSocketMessage) => {
        if (resolved) return;

        resolved = true;
        clearTimeout(timeout);

        clearListeners();

        reject(new Error(error.error || 'Request failed'));
      };

      const clearListeners = () => {
        websocketService.off('message', handleMessage);
        websocketService.off('error', handleError);
      };

      websocketService.on('message', handleMessage);
      websocketService.on('error', handleError);

      const timeoutDuration = 120_000; // 2 minutes to match assistant SLA

      const timeout = setTimeout(() => {
        if (resolved) return;

        resolved = true;
        clearListeners();

        reject(new RequestTimeoutError());
      }, timeoutDuration);

      websocketService.sendMessage(message).catch((sendError: unknown) => {
        if (resolved) return;

        resolved = true;
        clearTimeout(timeout);
        clearListeners();

        reject(
          sendError instanceof Error ? sendError : new Error('Falha ao enviar mensagem ao assistente.'),
        );
      });
    });
  }

  private isValidStructuredData(data: unknown): data is TapNavigationStructuredData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const structuredData = data as Partial<TapNavigationStructuredData>;

    if (!structuredData.layer || !['trends', 'topics', 'summary'].includes(structuredData.layer)) {
      return false;
    }

    return 'trends' in structuredData && 'topics' in structuredData && 'summary' in structuredData;
  }

  private normalizeStructuredData(data: TapNavigationStructuredData): TapNavigationStructuredData {
    return {
      layer: data.layer,
      trends: Array.isArray(data.trends) ? data.trends : null,
      topics: Array.isArray(data.topics) ? data.topics : null,
      summary:
        data.summary && typeof data.summary === 'object' && !Array.isArray(data.summary)
          ? data.summary
          : null,
      metadata: data.metadata ?? null,
    };
  }

  private formatErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof StructuredDataValidationError || error instanceof RequestTimeoutError) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return fallback;
  }

  async clearCache(): Promise<void> {
    await cacheStorage.clearAll();
  }
}

export const tapNavigationService = new TapNavigationService();
