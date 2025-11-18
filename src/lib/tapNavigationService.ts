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
  topicsSummary?: string | null;
  trendsSummary?: string | null;
}

class TapNavigationService {
  private pendingRequests = new Map<string, Promise<TapNavigationResponse>>();

  cancelTrendsRequest() {
    this.cancelPendingRequest('trends');
  }

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
          trendsSummary: null,
        };
      }

      const payload = await this.requestFromAgent('assuntos', 'trends');

      if (Array.isArray(payload.trends)) {
        await cacheStorage.setTrends(payload.trends as TrendData[]);
        return {
          success: true,
          data: payload.trends as TrendData[],
          fromCache: false,
          metadata: payload.metadata ?? undefined,
          trendsSummary: payload.trendsSummary ?? null,
        };
      }

      const invalidDataMessage = 'O assistente não retornou tendências válidas.';

      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
          error: `${invalidDataMessage} Exibindo dados em cache.`,
          trendsSummary: null,
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
          trendsSummary: null,
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
      const payload = await this.requestFromAgent('assuntos', 'trends');
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

      const payload = await this.requestFromAgent(`Assunto #${trendRank}`, ['topics', 'trends']);

      const topicsFromTopicsLayer =
        payload.layer === 'topics'
          ? payload.topics?.[trendRank] ?? Object.values(payload.topics ?? {})[0] ?? null
          : null;

      const topicsFromTrends = Array.isArray(payload.trends)
        ? (payload.trends.find((trend) => trend?.number === trendRank)?.topics ?? payload.trends[0]?.topics)
        : null;

      const topicsResult = topicsFromTrends ?? topicsFromTopicsLayer;

      if (Array.isArray(topicsResult)) {
        await cacheStorage.setTopics(trendRank, topicsResult as TopicData[]);
        return {
          success: true,
          data: topicsResult as TopicData[],
          fromCache: false,
          metadata: payload.metadata ?? undefined,
          topicsSummary: payload.metadata?.topicsSummary ?? payload.topicsSummary ?? null,
        };
      }

      const invalidDataMessage = 'O assistente não retornou tópicos válidos.';

      if (cached) {
        return {
          success: true,
          data: cached.data,
          fromCache: true,
          error: `${invalidDataMessage} Exibindo dados em cache.`,
          topicsSummary: null,
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
      const payload = await this.requestFromAgent(`Assunto #${trendRank}`, ['topics', 'trends']);
      const topicsFromTopicsLayer =
        payload.layer === 'topics'
          ? payload.topics?.[trendRank] ?? Object.values(payload.topics ?? {})[0] ?? null
          : null;

      const topicsFromTrends = Array.isArray(payload.trends)
        ? (payload.trends.find((trend) => trend?.number === trendRank)?.topics ?? payload.trends[0]?.topics)
        : null;

      const topicsResult = topicsFromTrends ?? topicsFromTopicsLayer;

      if (Array.isArray(topicsResult)) {
        await cacheStorage.setTopics(trendRank, topicsResult as TopicData[]);
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

      const payload = await this.requestFromAgent(`Tópico #${topicRank}`, 'summary');

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
      const payload = await this.requestFromAgent(`Tópico #${topicRank}`, 'summary');
      if (payload.summary) {
        await cacheStorage.setSummary(topicRank, userId, payload.summary as SummaryData);
      }
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }

  private cancelPendingRequest(cacheKey: string) {
    if (this.pendingRequests.has(cacheKey)) {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async requestFromAgent(
    message: string,
    expectedLayer: TapNavigationStructuredData['layer'] | TapNavigationStructuredData['layer'][],
  ): Promise<TapNavigationStructuredData> {
    return new Promise((resolve, reject) => {
      let resolved = false;

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

        if (response.type === 'message' && response.role === 'assistant') {
          const structuredData =
            resolveStructuredData(response.structuredData ?? (response as any).structured_data) ||
            resolveStructuredData((response as any).output);

          if (!structuredData) {
            console.warn('Received assistant message without structured data. Ignoring message.');
            return;
          }

          if (!this.isValidStructuredData(structuredData)) {
            console.warn('Received assistant message with invalid structured data. Ignoring message.');
            return;
          }

          const normalized = this.normalizeStructuredData(structuredData);
          const expectedLayers = Array.isArray(expectedLayer) ? expectedLayer : [expectedLayer];

          if (!expectedLayers.includes(normalized.layer)) {
            return;
          }

          resolved = true;
          clearTimeout(timeout);

          clearListeners();

          resolve(normalized);
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

    if (structuredData.layer === 'trends') {
      const hasValidTrends = Array.isArray(structuredData.trends);

      if (!hasValidTrends) {
        return false;
      }

      const trendsWithValidTopics = structuredData.trends.every((trend) => {
        if (!trend || typeof trend !== 'object') {
          return false;
        }

        if (!('topics' in trend)) {
          return true;
        }

        return Array.isArray((trend as Record<string, unknown>).topics);
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
                  .filter((item): item is SummaryData['sources'][number] => Boolean(item))
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
