import { websocketService } from './websocket';
import { cacheStorage } from './cacheStorage';
import {
  TrendData,
  TopicData,
  SummaryData,
  TapNavigationStructuredData,
} from '../types/tapNavigation';

export interface TapNavigationResponse {
  success: boolean;
  data?: TrendData[] | TopicData[] | SummaryData;
  fromCache?: boolean;
  error?: string;
  metadata?: Record<string, any>;
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

      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
        };
      }

      return {
        success: false,
        error: 'Failed to fetch trends',
      };
    } catch (error) {
      console.error('Error fetching trends:', error);

      const cached = await cacheStorage.getTrends();
      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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

      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
        };
      }

      return {
        success: false,
        error: 'Failed to fetch topics',
      };
    } catch (error) {
      console.error('Error fetching topics:', error);

      const cached = await cacheStorage.getTopics(trendRank);
      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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

      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
        };
      }

      return {
        success: false,
        error: 'Failed to fetch summary',
      };
    } catch (error) {
      console.error('Error fetching summary:', error);

      const cached = await cacheStorage.getSummary(topicRank, userId);
      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
      let timeout: NodeJS.Timeout;
      let resolved = false;

      const handleMessage = (response: any) => {
        if (resolved) return;

        if (response.type === 'message' && response.role === 'assistant') {
          resolved = true;
          clearTimeout(timeout);

          websocketService.off('message', handleMessage);
          websocketService.off('error', handleError);

          if (response.structuredData && this.isValidStructuredData(response.structuredData)) {
            resolve(this.normalizeStructuredData(response.structuredData));
          } else {
            reject(new Error('No structured data in response'));
          }
        }
      };

      const handleError = (error: any) => {
        if (resolved) return;

        resolved = true;
        clearTimeout(timeout);

        websocketService.off('message', handleMessage);
        websocketService.off('error', handleError);

        reject(new Error(error.error || 'Request failed'));
      };

      websocketService.on('message', handleMessage);
      websocketService.on('error', handleError);

      timeout = setTimeout(() => {
        if (resolved) return;

        resolved = true;
        websocketService.off('message', handleMessage);
        websocketService.off('error', handleError);

        reject(new Error('Request timeout'));
      }, 60000);

      websocketService.sendMessage(message).catch((error) => {
        if (resolved) return;

        resolved = true;
        clearTimeout(timeout);
        websocketService.off('message', handleMessage);
        websocketService.off('error', handleError);
        reject(error);
      });
    });
  }

  private isValidStructuredData(data: any): data is TapNavigationStructuredData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (!['trends', 'topics', 'summary'].includes(data.layer)) {
      return false;
    }

    return 'trends' in data && 'topics' in data && 'summary' in data;
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

  async clearCache(): Promise<void> {
    await cacheStorage.clearAll();
  }
}

export const tapNavigationService = new TapNavigationService();
