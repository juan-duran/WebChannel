import { websocketService, type WebSocketMessage } from './websocket';
import { fetchLatestDailyTrends } from './supabase';
import { cacheStorage } from './cacheStorage';
import {
  TrendData,
  TopicData,
  SummaryData,
  TapNavigationStructuredData,
  SourceData,
  TrendsCacheEntry,
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
  topicsSummary?: string | null;
  trendsSummary?: string | null;
}

class TapNavigationService {
  private pendingRequests = new Map<string, Promise<TapNavigationResponse>>();
  private currentTrendsAbort?: AbortController;
  private lastTrends: TrendsCacheEntry | null = null;

  cancelTrendsRequest() {
    if (this.currentTrendsAbort) {
      this.currentTrendsAbort.abort();
      this.currentTrendsAbort = undefined;
    }
    this.cancelPendingRequest('trends');
  }

  async fetchTrends(options?: { forceRefresh?: boolean }): Promise<TapNavigationResponse> {
    const cacheKey = 'trends';

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const controller = new AbortController();
    this.currentTrendsAbort = controller;

    const promise = this.fetchTrendsInternal(options, controller.signal).finally(() => {
      this.pendingRequests.delete(cacheKey);
      if (this.currentTrendsAbort === controller) {
        this.currentTrendsAbort = undefined;
      }
    });

    this.pendingRequests.set(cacheKey, promise);
    return promise;
  }

  private async fetchTrendsInternal(
    options?: { forceRefresh?: boolean },
    signal?: AbortSignal,
  ): Promise<TapNavigationResponse> {
    try {
      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }

      const cached = await cacheStorage.getTrends();
      if (cached && !options?.forceRefresh) {
        if (cacheStorage.isStale(cached)) {
          this.refreshTrendsInBackground();
        }

        this.lastTrends = cached.data;
        return {
          success: true,
          data: cached.data.trends,
          fromCache: true,
          trendsSummary: cached.data.trendsSummary ?? null,
          metadata: { version: cached.data.version },
        };
      }

      const { payload, version } = await fetchLatestDailyTrends();
      const normalizedTrends = this.normalizeTrendsPayload(payload.trends ?? []);
      const trendsSummary = typeof payload.trendsSummary === 'string' ? payload.trendsSummary : null;

      const cacheEntry: TrendsCacheEntry = {
        trends: normalizedTrends,
        trendsSummary,
        version,
      };

      await cacheStorage.setTrends(cacheEntry);
      this.lastTrends = cacheEntry;

      return {
        success: true,
        data: normalizedTrends,
        fromCache: false,
        trendsSummary,
        metadata: { version },
      };
    } catch (error) {
      console.error('Error fetching trends:', error);

      const cached = await cacheStorage.getTrends();
      if (cached) {
        const errorMessage = this.formatErrorMessage(error, 'Não foi possível carregar os assuntos.');
        return {
          success: true,
          data: cached.data.trends,
          fromCache: true,
          error: `${errorMessage} Exibindo dados em cache.`,
          trendsSummary: cached.data.trendsSummary ?? null,
          metadata: { version: cached.data.version },
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
      const { payload, version } = await fetchLatestDailyTrends();
      const normalizedTrends = this.normalizeTrendsPayload(payload.trends ?? []);
      const trendsSummary = typeof payload.trendsSummary === 'string' ? payload.trendsSummary : null;
      const cacheEntry: TrendsCacheEntry = {
        trends: normalizedTrends,
        trendsSummary,
        version,
      };
      await cacheStorage.setTrends(cacheEntry);
      this.lastTrends = cacheEntry;
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }

  async fetchTopics(
    trendRank: number,
    options?: { forceRefresh?: boolean; threadId?: string },
  ): Promise<TapNavigationResponse> {
    const cacheKey = this.buildTopicsRequestKey(trendRank, options?.threadId);

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

  private async fetchTopicsInternal(
    trendRank: number,
    options?: { forceRefresh?: boolean; threadId?: string },
  ): Promise<TapNavigationResponse> {
    const threadId = options?.threadId;

    try {
      const cachedTopics = await cacheStorage.getTopics(trendRank, threadId);
      const trendsCache = this.lastTrends ?? (await cacheStorage.getTrends())?.data ?? null;

      if (cachedTopics && !options?.forceRefresh) {
        if (cacheStorage.isStale(cachedTopics)) {
          this.refreshTopicsInBackground(trendRank, threadId);
        }
        return {
          success: true,
          data: cachedTopics.data,
          fromCache: true,
        };
      }

      const topicsFromTrends = trendsCache?.trends.find(
        (trend) => trend.number === trendRank || trend.id === threadId,
      )?.topics;

      if (Array.isArray(topicsFromTrends)) {
        await cacheStorage.setTopics(trendRank, topicsFromTrends as TopicData[], threadId);
        return {
          success: true,
          data: topicsFromTrends as TopicData[],
          fromCache: !cachedTopics,
        };
      }

      return {
        success: false,
        error: 'Não foi possível carregar os tópicos.',
      };
    } catch (error) {
      console.error('Error fetching topics:', error);

      const cached = await cacheStorage.getTopics(trendRank, threadId);
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

  private async refreshTopicsInBackground(trendRank: number, threadId?: string): Promise<void> {
    try {
      const trendsCache = this.lastTrends ?? (await cacheStorage.getTrends())?.data ?? null;
      const topicsFromTrends = trendsCache?.trends.find(
        (trend) => trend.number === trendRank || trend.id === threadId,
      )?.topics;
      if (Array.isArray(topicsFromTrends)) {
        await cacheStorage.setTopics(trendRank, topicsFromTrends as TopicData[], threadId);
      }
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }

  async fetchSummary(
    topicRank: number,
    trendRank: number,
    userId: string,
    options?: { forceRefresh?: boolean; trendId?: string; topicId?: string },
  ): Promise<TapNavigationResponse> {
    const cacheKey = `summary_${options?.trendId ?? trendRank}_${options?.topicId ?? topicRank}_${userId}`;

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const promise = this.fetchSummaryInternal(topicRank, trendRank, userId, options);
    this.pendingRequests.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async fetchSummaryInternal(
    topicRank: number,
    trendRank: number,
    userId: string,
    options?: { forceRefresh?: boolean; trendId?: string; topicId?: string },
  ): Promise<TapNavigationResponse> {
    try {
      const cached = await cacheStorage.getSummary(
        options?.topicId ?? topicRank,
        options?.trendId ?? trendRank,
        userId,
      );

      if (cached && !options?.forceRefresh) {
        if (cacheStorage.isStale(cached)) {
          this.refreshSummaryInBackground(options?.topicId ?? topicRank, options?.trendId ?? trendRank, userId);
        }

        return {
          success: true,
          data: cached.data.summary,
          fromCache: true,
          metadata: cached.data.metadata ?? undefined,
        };
      }

      const message = `Assunto ${options?.trendId ?? trendRank} topico ${options?.topicId ?? topicRank}`;
      const payload = await this.requestFromAgent(message, 'summary');

      if (payload.summary) {
        await cacheStorage.setSummary(
          options?.topicId ?? topicRank,
          options?.trendId ?? trendRank,
          userId,
          payload.summary as SummaryData,
          payload.metadata ?? undefined,
        );
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
          data: cached.data.summary,
          fromCache: true,
          metadata: cached.data.metadata ?? undefined,
          error: `${invalidDataMessage} Exibindo dados em cache.`,
        };
      }

      return {
        success: false,
        error: invalidDataMessage,
      };
    } catch (error) {
      console.error('Error fetching summary:', error);

      const cached = await cacheStorage.getSummary(
        options?.topicId ?? topicRank,
        options?.trendId ?? trendRank,
        userId,
      );
      const message = `Assunto ${options?.trendId ?? trendRank} topico ${options?.topicId ?? topicRank}`;
      if (cached) {
        const errorMessage = this.formatErrorMessage(error, 'Não foi possível carregar o resumo.');
        return {
          success: true,
          data: cached.data.summary,
          fromCache: true,
          metadata: cached.data.metadata ?? undefined,
          error: `${errorMessage} Exibindo dados em cache.`,
        };
      }

      return {
        success: false,
        error: this.formatErrorMessage(error, 'Não foi possível carregar o resumo.'),
      };
    }
  }

  private async refreshSummaryInBackground(
    topicRank: number | string,
    trendRank: number | string,
    userId: string,
  ): Promise<void> {
    try {
      const message = `Assunto ${trendRank} topico ${topicRank}`;
      const payload = await this.requestFromAgent(message, 'summary');
      if (payload.summary) {
        await cacheStorage.setSummary(
          topicRank,
          trendRank,
          userId,
          payload.summary as SummaryData,
          payload.metadata ?? undefined,
        );
      }
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }

  async invalidateSummaryCache(
    topicRank: number | string,
    trendRank: number | string,
    userId: string,
  ): Promise<void> {
    await cacheStorage.deleteSummary(topicRank, trendRank, userId);
  }

  private cancelPendingRequest(cacheKey: string) {
    if (this.pendingRequests.has(cacheKey)) {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async requestFromAgent(
    message: string,
    expectedLayer: TapNavigationStructuredData['layer'] | TapNavigationStructuredData['layer'][],
    options?: { signal?: AbortSignal },
  ): Promise<TapNavigationStructuredData> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const correlationId = websocketService.generateCorrelationId();
      const maxReplayAttempts = 3;
      const abortSignal = options?.signal;

      const resolveStructuredData = (candidate: unknown): unknown => {
        if (!candidate) return null;

        if (Array.isArray(candidate)) {
          if (candidate.length === 1) {
            return resolveStructuredData(candidate[0]);
          }

          return null;
        }

        if (typeof candidate === 'object') {
          const candidateObject = candidate as Record<string, unknown>;

          if ('structuredData' in candidateObject && candidateObject.structuredData) {
            return candidateObject.structuredData;
          }

          if ('structured_data' in candidateObject && candidateObject.structured_data) {
            return candidateObject.structured_data;
          }
        }

        return candidate;
      };

      const handleMessage = (response: WebSocketMessage) => {
        if (resolved) return;

        if (response.correlationId && response.correlationId !== correlationId) {
          return;
        }

        if (response.type === 'message' && response.role === 'assistant') {
          const structuredData =
            resolveStructuredData(response.structuredData ?? (response as any).structured_data) ||
            resolveStructuredData((response as any).output);

          let normalized: TapNavigationStructuredData | null = null;

          if (structuredData && this.isValidStructuredData(structuredData)) {
            normalized = this.normalizeStructuredData(structuredData);
          } else if (
            !structuredData &&
            response.contentType === 'summary' &&
            typeof response.content === 'string' &&
            expectedLayer === 'summary'
          ) {
            // Fallback: accept a summary delivered as plain text when structured data is missing.
            normalized = {
              layer: 'summary',
              trends: null,
              topics: null,
              summary: { thesis: response.content },
            };
          } else {
            console.warn('Received assistant message without usable structured data. Ignoring message.');
            return;
          }

          const expectedLayers = Array.isArray(expectedLayer) ? expectedLayer : [expectedLayer];

          if (!normalized || !expectedLayers.includes(normalized.layer)) {
            return;
          }

          resolved = true;
          clearTimeout(timeout);

          cleanup();

          resolve(normalized);
        }
      };

      const handleLegacyMessage = (response: WebSocketMessage) => {
        if (response.correlationId) return;
        handleMessage(response);
      };

      const handleError = (error: WebSocketMessage) => {
        if (resolved) return;

        const connectionState = websocketService.getConnectionState();
        const fatalConnectionFailure =
          !websocketService.isReconnectingInProgress() &&
          (connectionState === 'disconnected' || connectionState === 'error');

        if (!fatalConnectionFailure) {
          return;
        }

        resolved = true;
        clearTimeout(timeout);
        cleanup();
        reject(new Error(error.error || 'Request failed'));
      };

      const handleReplayFailure = () => {
        if (resolved) return;

        resolved = true;
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Não foi possível reenviar sua solicitação ao assistente. Tente novamente.'));
      };

      const cleanup = () => {
        websocketService.offCorrelation(correlationId, handleMessage);
        websocketService.off('message', handleLegacyMessage);
        websocketService.off('error', handleError);
        websocketService.offRequestReplayExhausted(correlationId, handleReplayFailure);
        websocketService.cancelQueuedRequest(correlationId);
        if (abortSignal) {
          abortSignal.removeEventListener('abort', handleAbort);
        }
      };

      websocketService.onCorrelation(correlationId, handleMessage);
      websocketService.on('message', handleLegacyMessage);
      websocketService.on('error', handleError);
      websocketService.onRequestReplayExhausted(correlationId, handleReplayFailure);

      const handleAbort = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Request cancelled'));
      };

      if (abortSignal) {
        if (abortSignal.aborted) {
          handleAbort();
          return;
        }
        abortSignal.addEventListener('abort', handleAbort, { once: true });
      }

      const timeoutDuration = 120_000; // 2 minutes to match assistant SLA

      const timeout = setTimeout(() => {
        if (resolved) return;

        resolved = true;
        cleanup();
        reject(new RequestTimeoutError());
      }, timeoutDuration);

      websocketService
        .sendMessage(message, undefined, {
          correlationId,
          track: true,
          maxRetries: maxReplayAttempts,
        })
        .catch((sendError: unknown) => {
          if (resolved) return;

          resolved = true;
          clearTimeout(timeout);
          cleanup();

          reject(
            sendError instanceof Error
              ? sendError
              : new Error('Falha ao enviar mensagem ao assistente.'),
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

    if (structuredData.layer === 'trends') {
      if (!Array.isArray(structuredData.trends)) {
        return false;
      }

      const trendsWithValidTopics = structuredData.trends.every((trend) => {
        if (!trend || typeof trend !== 'object') {
          return false;
        }

        if (!('topics' in trend)) {
          return true;
        }

        const trendRecord = trend as { topics?: unknown };
        return Array.isArray(trendRecord.topics);
      });

      return trendsWithValidTopics;
    }

    if (structuredData.layer === 'topics') {
      const hasValidTopics = Array.isArray((structuredData as any).topics);
      return hasValidTopics;
    }

    return Boolean(structuredData.summary && typeof structuredData.summary === 'object');
  }

  private normalizeStructuredData(data: TapNavigationStructuredData): TapNavigationStructuredData {
    const trendsSummary =
      typeof (data as any).trendsSummary === 'string' && (data as any).trendsSummary.trim().length > 0
        ? (data as any).trendsSummary
        : null;

    const normalizeTopicItem = (topicItem: any, index: number): TopicData | null => {
      if (!topicItem || typeof topicItem !== 'object') {
        return null;
      }

      const id = typeof topicItem.id === 'string' ? topicItem.id : `topic_${index + 1}`;
      const number =
        typeof topicItem.number === 'number'
          ? topicItem.number
          : typeof topicItem.rank === 'number'
          ? topicItem.rank
          : index + 1;
      const description =
        typeof topicItem.description === 'string'
          ? topicItem.description
          : typeof topicItem.summary === 'string'
          ? topicItem.summary
          : '';
      if (!description) {
        return null;
      }

      const likesData =
        typeof topicItem['likes-data'] === 'string'
          ? topicItem['likes-data']
          : typeof topicItem.likesData === 'string'
          ? topicItem.likesData
          : '';

      return {
        id,
        number,
        description,
        ...(likesData ? { 'likes-data': likesData, likesData } : {}),
      } satisfies TopicData;
    };

    const normalizeTopicsFromArray = (value: unknown): TopicData[] | null =>
      Array.isArray(value)
        ? value
            .map((item, index) => normalizeTopicItem(item, index))
            .filter((topic): topic is TopicData => Boolean(topic))
        : null;

    const resolveUrl = (...values: unknown[]): string => {
      for (const candidate of values) {
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed) {
            return trimmed;
          }
        } else if (typeof candidate === 'number' && Number.isFinite(candidate)) {
          return String(candidate);
        }
      }
      return '';
    };

    const resolveOptionalString = (...values: unknown[]): string | undefined => {
      for (const candidate of values) {
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed) {
            return trimmed;
          }
        }
      }
      return undefined;
    };

    const normalizeTrends = Array.isArray((data as any).trends)
      ? (data as any).trends
          .map((item: any, index: number): TrendData | null => {
            if (!item || typeof item !== 'object') {
              return null;
            }

            const id = typeof item.id === 'string' ? item.id : `trend_${index + 1}`;
            const number =
              typeof item.number === 'number'
                ? item.number
                : typeof item.rank === 'number'
                ? item.rank
                : index + 1;
            const category = typeof item.category === 'string' ? item.category : '';

            const fallbackNameFromDescription = (value: unknown): string | undefined => {
              if (typeof value !== 'string') {
                return undefined;
              }

              const trimmed = value.trim();
              if (!trimmed) {
                return undefined;
              }

              const [firstSentence] = trimmed.split(/(?<=[.!?])\s+/);
              return firstSentence || trimmed;
            };

            const rawName =
              typeof item.name === 'string'
                ? item.name
                : typeof item.title === 'string'
                ? item.title
                : typeof item.label === 'string'
                ? item.label
                : undefined;

            const name =
              rawName ??
              fallbackNameFromDescription(item.headline) ??
              fallbackNameFromDescription(item.description) ??
              `Assunto #${number}`;

            const description =
              typeof item.description === 'string'
                ? item.description
                : typeof item.summary === 'string'
                ? item.summary
                : '';
            const value = typeof item.value === 'string' ? item.value : '';
            const url = resolveUrl(
              item.asset_short_url,
              item.assetShortUrl,
              item.assetShortURL,
              item.asset_short_link,
              item.assetShortLink,
              item.asset_link,
              item.assetLink,
              item.short_url,
              item.shortUrl,
              item.url,
              item.link,
              item.href,
            );
            const threadId = this.normalizeId(
              (item as any).thread_id ?? (item as any).threadId ?? (item as any).thread,
            );
            const assetType = resolveOptionalString(item.asset_type, item.assetType);
            const assetThumbnail = resolveOptionalString(
              item.asset_thumbnail,
              item.assetThumbnail,
              item.asset_thumbnail_url,
              item.assetThumbnailUrl,
              item.thumbnail,
              item.image,
              item.preview_image,
            );
            const assetTitle = resolveOptionalString(item.asset_title, item.assetTitle);
            const assetDescription = resolveOptionalString(
              item.asset_description,
              item.assetDescription,
              item.asset_summary,
            );
            const assetEmbedHtml = resolveOptionalString(
              item.asset_embed_html,
              item.assetEmbedHtml,
              item.embed_html,
            );
            const whyItMatters =
              typeof item.whyItMatters === 'string'
                ? item.whyItMatters
                : typeof item['why_it_matters'] === 'string'
                ? item['why_it_matters']
                : '';

            const rawTopics = Array.isArray(item.topics) ? item.topics : null;
            const normalizedTopics = rawTopics ? normalizeTopicsFromArray(rawTopics) : null;

            return {
              id,
              number,
              category,
              name,
              description,
              value,
              url,
              ...(threadId ? { thread_id: threadId } : {}),
              whyItMatters,
              ...(assetType || assetThumbnail || assetTitle || assetDescription || assetEmbedHtml || url
                ? {
                    ...(assetType ? { assetType } : {}),
                    ...(assetThumbnail ? { assetThumbnail } : {}),
                    ...(assetTitle ? { assetTitle } : {}),
                    ...(assetDescription ? { assetDescription } : {}),
                    ...(assetEmbedHtml ? { assetEmbedHtml } : {}),
                    ...(url ? { assetUrl: url } : {}),
                  }
                : {}),
              ...(normalizedTopics && normalizedTopics.length > 0 ? { topics: normalizedTopics } : {}),
            } satisfies TrendData;
          })
          .filter((trend: TrendData | null): trend is TrendData => Boolean(trend))
      : null;

    const topicsFromPayload = normalizeTopicsFromArray((data as any).topics);

    const topicsMap = topicsFromPayload
      ? (() => {
          const trendNumberCandidate = (value: unknown): number | null => {
            if (typeof value === 'number' && Number.isFinite(value)) {
              return value;
            }

            if (typeof value === 'string') {
              const parsed = Number(value.trim());
              return Number.isFinite(parsed) ? parsed : null;
            }

            return null;
          };

          const inferredTrendNumber =
            trendNumberCandidate((data as any).trendNumber) ??
            trendNumberCandidate((data as any).trendRank) ??
            trendNumberCandidate((data as any).rank) ??
            trendNumberCandidate((data.metadata as any)?.trendNumber) ??
            trendNumberCandidate((data.metadata as any)?.trendRank) ??
            1;

          return { [inferredTrendNumber]: topicsFromPayload } as Record<number, TopicData[]>;
        })()
      : null;

    const summary =
      (data as any).summary && typeof (data as any).summary === 'object' && !Array.isArray((data as any).summary)
        ? (() => {
            const rawSummary = (data as any).summary as Record<string, unknown>;

            const likesDataCandidate =
              typeof rawSummary['likes-data'] === 'string'
                ? (rawSummary['likes-data'] as string)
                : typeof rawSummary.likesData === 'string'
                ? (rawSummary.likesData as string)
                : '';

            const contextValue = rawSummary.context;
            const context: string[] = Array.isArray(contextValue)
              ? contextValue.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              : typeof contextValue === 'string' && contextValue.trim().length > 0
              ? [contextValue]
              : [];

            const debateValue = rawSummary.debate;
            const debate: string[] = Array.isArray(debateValue)
              ? debateValue.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              : typeof debateValue === 'string' && debateValue.trim().length > 0
              ? [debateValue]
              : [];

            const resolveId = (...values: unknown[]): string | undefined => {
              for (const value of values) {
                if (typeof value === 'string' || typeof value === 'number') {
                  const normalized = String(value).trim();
                  if (normalized) {
                    return normalized;
                  }
                }
              }
              return undefined;
            };

            const threadId = resolveId(rawSummary.thread_id, rawSummary.threadId, rawSummary.thread);
            const commentId = resolveId(rawSummary.comment_id, rawSummary.commentId, rawSummary.comment);

            const sourcesValue = rawSummary.sources;
            const sources = Array.isArray(sourcesValue)
              ? sourcesValue
                  .map((item) => {
                    if (!item || typeof item !== 'object') {
                      return null;
                    }

                    const sourceRecord = item as Record<string, unknown>;
                    const url =
                      typeof sourceRecord.url === 'string'
                        ? sourceRecord.url
                        : typeof sourceRecord.link === 'string'
                        ? sourceRecord.link
                        : undefined;

                    if (!url) {
                      return null;
                    }

                    const title =
                      typeof sourceRecord.title === 'string'
                        ? sourceRecord.title
                        : typeof sourceRecord.name === 'string'
                        ? sourceRecord.name
                        : url;

                    const publishedAtCandidate =
                      typeof sourceRecord.publishedAt === 'string'
                        ? sourceRecord.publishedAt
                        : typeof sourceRecord.published_at === 'string'
                        ? sourceRecord.published_at
                        : typeof sourceRecord.date === 'string'
                        ? sourceRecord.date
                        : undefined;

                    return {
                      title,
                      url,
                      ...(publishedAtCandidate ? { publishedAt: publishedAtCandidate } : {}),
                    };
                  })
                  .filter((item): item is SourceData => Boolean(item))
              : undefined;

            return {
              'topic-name':
                typeof rawSummary['topic-name'] === 'string'
                  ? (rawSummary['topic-name'] as string)
                  : typeof rawSummary.topicName === 'string' && rawSummary.topicName.trim().length > 0
                  ? (rawSummary.topicName as string)
                  : 'Tópico',
              ...(() => {
                const topicName =
                  typeof rawSummary['topic-name'] === 'string'
                    ? (rawSummary['topic-name'] as string)
                    : typeof rawSummary.topicName === 'string'
                    ? (rawSummary.topicName as string)
                    : undefined;

                return topicName ? { topicName } : {};
              })(),
              ...(likesDataCandidate
                ? { 'likes-data': likesDataCandidate, likesData: likesDataCandidate }
                : {}),
              ...(threadId ? { thread_id: threadId } : {}),
              ...(commentId ? { comment_id: commentId } : {}),
              ...(context.length ? { context } : {}),
              thesis:
                typeof rawSummary.thesis === 'string' ? (rawSummary.thesis as string) : (rawSummary.summary as string) || '',
              ...(debate.length ? { debate } : {}),
              ...(typeof rawSummary.personalization === 'string'
                ? { personalization: rawSummary.personalization as string }
                : {}),
              ...(
                typeof rawSummary.whyItMatters === 'string'
                  ? { 'why-it-matters': rawSummary.whyItMatters as string, whyItMatters: rawSummary.whyItMatters as string }
                  : typeof rawSummary['why_it_matters'] === 'string'
                  ? { 'why-it-matters': rawSummary['why_it_matters'] as string, whyItMatters: rawSummary['why_it_matters'] as string }
                  : {}
              ),
              ...(sources ? { sources } : {}),
            } satisfies SummaryData;
          })()
        : null;

    const metadata =
      data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
        ? (() => {
            const trendName =
              typeof (data.metadata as any)['trend-name'] === 'string'
                ? (data.metadata as any)['trend-name']
                : typeof (data.metadata as any).trendName === 'string' && (data.metadata as any).trendName.trim().length > 0
                ? (data.metadata as any).trendName
                : null;

            const topicName =
              typeof (data.metadata as any)['topic-name'] === 'string'
                ? (data.metadata as any)['topic-name']
                : typeof (data.metadata as any).topicName === 'string' && (data.metadata as any).topicName.trim().length > 0
                ? (data.metadata as any).topicName
                : null;

            const threadId = resolveOptionalString(
              (data.metadata as any).thread_id,
              (data.metadata as any).threadId,
              (data.metadata as any).thread,
            );
            const commentId = resolveOptionalString(
              (data.metadata as any).comment_id,
              (data.metadata as any).commentId,
              (data.metadata as any).comment,
            );

            const topicsSummary =
              typeof (data.metadata as any).topicsSummary === 'string' &&
              (data.metadata as any).topicsSummary.trim().length > 0
                ? (data.metadata as any).topicsSummary
                : null;

            return {
              ...data.metadata,
              'trend-name': trendName,
              'topic-name': topicName,
              ...(trendName ? { trendName } : {}),
              ...(topicName ? { topicName } : {}),
              ...(topicsSummary ? { topicsSummary } : {}),
              ...(threadId ? { thread_id: threadId } : {}),
              ...(commentId ? { comment_id: commentId } : {}),
            };
          })()
        : null;

    return {
      layer: data.layer,
      trends: normalizeTrends,
      topics: topicsMap,
      trendsSummary,
      topicsSummary:
        typeof (data as any).topicsSummary === 'string' && (data as any).topicsSummary.trim().length > 0
          ? (data as any).topicsSummary
          : null,
      summary,
      metadata,
    };
  }

  private buildTopicsRequestKey(trendRank: number, threadId?: string): string {
    return `topics_${trendRank}_${threadId ?? 'no-thread'}`;
  }

  private normalizeId(value: unknown): string | undefined {
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = String(value).trim();
      return normalized || undefined;
    }

    return undefined;
  }

  private normalizeTrendsPayload(trends: unknown[]): TrendData[] {
    const toStringValue = (value: unknown): string | undefined => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
      return undefined;
    };

    const toNumberValue = (value: unknown): number | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      return undefined;
    };

    const normalizeTopic = (topic: any, index: number): TopicData | null => {
      if (!topic || typeof topic !== 'object') {
        return null;
      }

      const id = toStringValue(topic.id) ?? `topic_${index + 1}`;
      const number = toNumberValue(topic.number) ?? index + 1;
      const description =
        toStringValue(topic.description) ?? toStringValue(topic.summary) ?? toStringValue(topic.comment);

      if (!description) {
        return null;
      }

      const likesData =
        toStringValue(topic['likes-data']) ?? toStringValue(topic.likesData) ?? toStringValue(topic.engagement);

      return {
        id,
        number,
        description,
        ...(likesData ? { 'likes-data': likesData, likesData } : {}),
        replies_total: toNumberValue(topic.replies_total),
        author: toStringValue(topic.author),
        upvotes: toNumberValue(topic.upvotes),
        posted_at: toStringValue(topic.posted_at),
      };
    };

    return trends
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;

        const trend = item as Record<string, unknown>;
        const position =
          toNumberValue(trend.position) ??
          toNumberValue(trend.number) ??
          toNumberValue((trend as any).rank) ??
          index + 1;
        const number = position ?? index + 1;

        const id = toStringValue(trend.id) ?? `trend_${number}`;
        const title = toStringValue(trend.title) ?? toStringValue((trend as any).name);
        const snippet = toStringValue(trend.snippet) ?? toStringValue(trend.description);
        const highlight =
          toStringValue(trend.top_comment_preview) ??
          toStringValue((trend as any).topCommentPreview) ??
          toStringValue((trend as any).top_comment);

        const normalizedTopics = Array.isArray(trend.topics)
          ? trend.topics
              .map((topic, topicIndex) => normalizeTopic(topic, topicIndex))
              .filter((topic): topic is TopicData => Boolean(topic))
          : undefined;

        const url =
          toStringValue(trend.asset_short_url) ??
          toStringValue((trend as any).assetShortUrl) ??
          toStringValue(trend.url) ??
          undefined;

        return {
          id,
          number,
          position,
          category: toStringValue(trend.category),
          title: title ?? `Assunto #${number}`,
          name: title ?? `Assunto #${number}`,
          snippet: snippet ?? '',
          description: snippet ?? '',
          top_comment_preview: highlight,
          topCommentPreview: highlight,
          value: toStringValue(trend.value),
          upvotes: toNumberValue(trend.upvotes),
          comments_total: toNumberValue(trend.comments_total),
          root_comments: toNumberValue(trend.root_comments),
          comments_last_4h: toNumberValue(trend.comments_last_4h),
          posted_at: toStringValue(trend.posted_at),
          last_captured_at: toStringValue(trend.last_captured_at),
          url,
          asset_short_url: toStringValue(trend.asset_short_url) ?? url,
          whyItMatters: toStringValue(trend.whyItMatters),
          trend_heat: toNumberValue(trend.trend_heat),
          thread_id: toStringValue(trend.thread_id ?? trend.id),
          topics: normalizedTopics,
        } satisfies TrendData;
      })
      .filter((trend): trend is TrendData => Boolean(trend));
  }

  private async tryRecoverStructuredData(
    _correlationId: string,
    _expectedLayer: TapNavigationStructuredData['layer'] | TapNavigationStructuredData['layer'][] ,
  ): Promise<TapNavigationStructuredData | null> {
    return null;
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
