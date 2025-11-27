import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { TrendCard } from '../components/tap/TrendCard';
import { TrendSkeleton } from '../components/tap/LoadingProgress';
import { DailyTrend, DailyTrendTopic, DailyTrendsPayload } from '../types/dailyTrends';
import { type DailyTrendsRow, supabase } from '../lib/supabase';
import { safeJsonParse } from '../lib/safeJsonParse';
import { SummaryData } from '../types/tapNavigation';
import { websocketService } from '../lib/websocket';
import { extractTopicEngagement } from '../utils/topicEngagement';
import { useCurrentUser } from '../state/UserContext';

const sharedSummaryCache = new Map<
  string,
  {
    summary: SummaryData;
    metadata: Record<string, unknown> | null;
    fromCache: boolean;
  }
>();
const SUMMARY_CACHE_STORAGE_KEY = 'tap_summary_cache';

const parseTrendsPayload = (payload: DailyTrendsRow['payload']): DailyTrendsPayload | null => {
  if (!payload) return null;

  if (typeof payload === 'string') {
    return safeJsonParse<DailyTrendsPayload>(payload);
  }

  return payload;
};

export function TapNavigationPage() {
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [trendsSummary, setTrendsSummary] = useState<string | null>(null);
  const [expandedTrendId, setExpandedTrendId] = useState<number | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<DailyTrendTopic | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<SummaryData | null>(null);
  const [summaryMetadata, setSummaryMetadata] = useState<Record<string, unknown> | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryFromCache, setSummaryFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summaryCacheRef = useRef(sharedSummaryCache);
  const lastBatchRef = useRef<string | null>(null);
  const persistedBatchRef = useRef<string | null>(null);

  const mobileListContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileSummaryWrapperRef = useRef<HTMLDivElement | null>(null);
  const mobileListScrollPosition = useRef(0);
  const { email } = useCurrentUser();

  const formatTimestamp = useMemo(() => {
    if (!lastUpdated) return null;
    const date = new Date(lastUpdated);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }, [lastUpdated]);

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
    }).format(date);
  }, []);

  const summaryTopicName =
    selectedSummary?.['topic-name'] ??
    selectedSummary?.topicName ??
    ((summaryMetadata?.['topic-name'] as string) || (summaryMetadata?.topicName as string) || undefined);
  const summaryTrendName = (summaryMetadata?.trendName as string) ?? (summaryMetadata?.['trend-name'] as string);
  const summaryLikesData = selectedSummary?.['likes-data'] ?? selectedSummary?.likesData;
  const summaryTopicsSummary = (summaryMetadata?.topicsSummary as string) ?? (summaryMetadata?.['topicsSummary'] as string);
  const summaryContext = Array.isArray(selectedSummary?.context)
    ? selectedSummary.context.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const summaryDebate = Array.isArray(selectedSummary?.debate)
    ? selectedSummary.debate.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const createCacheKey = useCallback((trendId: string | number | null | undefined, topicId: string | number | null | undefined) => {
    const normalize = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    };

    return `${normalize(trendId)}::${normalize(topicId)}`;
  }, []);

  const coalesceString = useCallback((...values: unknown[]): string | undefined => {
    for (const value of values) {
      if (typeof value === 'string' || typeof value === 'number') {
        const normalized = String(value).trim();
        if (normalized.length > 0) {
          return normalized;
        }
      }
    }

    return undefined;
  }, []);

  const extractSummaryText = useCallback(
    (input: unknown): string | undefined => {
      if (input === null || input === undefined) return undefined;

      if (typeof input === 'string' || typeof input === 'number') {
        const normalized = String(input).trim();
        return normalized.length > 0 ? normalized : undefined;
      }

      if (Array.isArray(input)) {
        for (const item of input) {
          const extracted = extractSummaryText(item);
          if (extracted) return extracted;
        }
        return undefined;
      }

      if (typeof input !== 'object') return undefined;

      const objectInput = input as Record<string, unknown>;

      const directCandidate = coalesceString(
        objectInput.summary,
        objectInput.text,
        objectInput.message,
        objectInput.content,
        objectInput.reply,
        objectInput.headline,
        objectInput.description,
        objectInput.title,
        objectInput.thesis,
        objectInput.personalization,
        (objectInput.body as Record<string, unknown> | undefined)?.content,
        (objectInput.body as Record<string, unknown> | undefined)?.text,
      );

      if (directCandidate) return directCandidate;

      const nestedCandidates = [
        objectInput.summary,
        objectInput.output,
        objectInput.data,
        objectInput.payload,
        objectInput.structuredData,
        objectInput.structured_data,
        (objectInput.data as Record<string, unknown> | undefined)?.structuredData,
        (objectInput.data as Record<string, unknown> | undefined)?.structured_data,
      ];

      for (const nested of nestedCandidates) {
        const extracted = extractSummaryText(nested);
        if (extracted) return extracted;
      }

      return undefined;
    },
    [coalesceString],
  );

  const normalizeSummaryPayload = useCallback(
    (
      summaryPayload: unknown,
      metadata?: Record<string, unknown> | null,
    ): SummaryData | null => {
      const payloadAsObject =
        summaryPayload && typeof summaryPayload === 'object' && !Array.isArray(summaryPayload)
          ? (summaryPayload as SummaryData)
          : null;

      const primaryText = extractSummaryText(summaryPayload);
      const metadataText = extractSummaryText(metadata);
      const normalizedThesis =
        (payloadAsObject?.thesis && extractSummaryText(payloadAsObject.thesis)) ||
        primaryText ||
        metadataText ||
        (payloadAsObject?.personalization && extractSummaryText(payloadAsObject.personalization));

      if (payloadAsObject) {
        if (!payloadAsObject.thesis && normalizedThesis) {
          return { ...payloadAsObject, thesis: normalizedThesis };
        }

        if (payloadAsObject.thesis) {
          return payloadAsObject;
        }
      }

      if (normalizedThesis) {
        return { thesis: normalizedThesis };
      }

      return null;
    },
    [extractSummaryText],
  );

  const fetchSummaryForTopic = useCallback(
    async (trend: DailyTrend, topic: DailyTrendTopic, options?: { forceRefresh?: boolean }) => {
      setSummaryError(null);
      setSelectedSummary(null);
      setSummaryMetadata(null);
      setSummaryFromCache(false);
      setIsLoadingSummary(true);

      const trendId = (trend.id ?? trend.position ?? trend.title ?? '').toString();
      const topicId = (topic.id ?? topic.number ?? topic.description ?? '').toString();
      const correlationId = websocketService.generateCorrelationId();
      const startedAt = performance.now();
      const startedAtIso = new Date().toISOString();

      const startLogContext = {
        event: 'summary_fetch',
        status: 'started' as const,
        correlationId,
        trendId,
        topicId,
        forceRefresh: options?.forceRefresh ?? false,
        connectionState: websocketService.getConnectionState(),
        timestamp: startedAtIso,
      };

      console.log('[TapNavigationPage] Fetching summary for topic', startLogContext);

      try {
        const connectionState = websocketService.getConnectionState();

        if (connectionState !== 'connected') {
          console.warn('[TapNavigationPage] WebSocket not connected; realtime updates disabled for summary fetch', {
            ...startLogContext,
            status: 'ws_not_connected',
            connectionState,
          });
        }

        const response = await fetch('/api/trends/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ topicId, trendId, email, forceRefresh: options?.forceRefresh, correlationId }),
        });

        if (!response.ok) {
          const message = 'Não foi possível obter o resumo.';
          setSummaryError(message);

          console.error('[TapNavigationPage] Summary fetch failed (HTTP)', {
            ...startLogContext,
            status: 'failed',
            connectionState,
            durationMs: Math.round(performance.now() - startedAt),
            httpStatus: response.status,
            httpStatusText: response.statusText,
          });

          return;
        }

        const data: { summary?: SummaryData | string; metadata?: Record<string, unknown>; fromCache?: boolean } =
          await response.json();

        const normalizedSummary = normalizeSummaryPayload(data?.summary, data?.metadata);

        if (normalizedSummary) {
          setSelectedSummary(normalizedSummary);
          setSummaryMetadata((data.metadata as Record<string, unknown>) ?? null);
          setSummaryFromCache(Boolean(data.fromCache));

          const resolveMetadataId = (
            metadata: Record<string, unknown> | null | undefined,
            keys: string[],
            fallback: string,
          ) => {
            if (!metadata) return fallback;

            for (const key of keys) {
              const value = metadata[key];

              if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
                return String(value).trim();
              }
            }

            return fallback;
          };

          const resolvedTrendId = resolveMetadataId(data.metadata, ['trendId', 'trend-id'], trendId);
      const resolvedTopicId = resolveMetadataId(data.metadata, ['topicId', 'topic-id'], topicId);

      const cacheKey = createCacheKey(resolvedTrendId, resolvedTopicId);
      const fallbackCacheKey = createCacheKey(trendId, topicId);

      const cacheEntry = {
        summary: normalizedSummary,
        metadata: (data.metadata as Record<string, unknown>) ?? null,
        fromCache: Boolean(data.fromCache),
      };

      summaryCacheRef.current.set(cacheKey, cacheEntry);
      if (cacheKey !== fallbackCacheKey) {
        summaryCacheRef.current.set(fallbackCacheKey, cacheEntry);
      }
      persistSummaryCache();

      console.log('[TapNavigationPage] Summary fetched successfully', {
        event: 'summary_fetch',
        status: 'succeeded' as const,
        correlationId,
            trendId,
            topicId,
            resolvedTrendId,
            resolvedTopicId,
            connectionState: websocketService.getConnectionState(),
            fromCache: Boolean(data.fromCache),
            durationMs: Math.round(performance.now() - startedAt),
            timestamp: startedAtIso,
          });
        } else {
          const message = 'Não foi possível obter o resumo.';
          setSummaryError(message);

          console.error('[TapNavigationPage] Summary fetch failed', {
            event: 'summary_fetch',
            status: 'failed' as const,
            correlationId,
            trendId,
            topicId,
            connectionState: websocketService.getConnectionState(),
            durationMs: Math.round(performance.now() - startedAt),
            error: 'summary_missing',
            timestamp: startedAtIso,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao obter o resumo.';
        setSummaryError(message);
        setSummaryMetadata(null);

        console.error('[TapNavigationPage] Summary fetch threw unexpectedly', {
          event: 'summary_fetch',
          status: 'exception' as const,
          correlationId,
          trendId,
          topicId,
          connectionState: websocketService.getConnectionState(),
          durationMs: Math.round(performance.now() - startedAt),
          error: err,
          timestamp: startedAtIso,
        });
      } finally {
        setIsLoadingSummary(false);
      }
    },
    [createCacheKey, email, normalizeSummaryPayload],
  );

  const fetchLatestTrends = useCallback(async (options?: { isRefresh?: boolean }) => {
    const isRefresh = options?.isRefresh ?? false;
    setError(null);
    setIsLoading((prev) => prev || !isRefresh);
    setIsRefreshing(isRefresh);

    try {
      const { data, error: supabaseError } = await supabase
        .from<'daily_trends', DailyTrendsRow>('daily_trends')
        .select('batch_ts, payload')
        .order('batch_ts', { ascending: false })
        .limit(1)
        .single();

      if (supabaseError) {
        throw supabaseError;
      }

      if (!data) {
        throw new Error('Nenhum dado disponível.');
      }

      const parsed = parseTrendsPayload(data.payload);

      if (!parsed) {
        throw new Error('Não foi possível interpretar os dados de tendências.');
      }

      if (lastBatchRef.current && lastBatchRef.current !== data.batch_ts) {
        summaryCacheRef.current.clear();
      }
      lastBatchRef.current = data.batch_ts ?? null;
      persistedBatchRef.current = data.batch_ts ?? null;
      const nextTrends = Array.isArray(parsed.trends) ? parsed.trends : [];
      setTrends(nextTrends);
      setTrendsSummary(parsed.trendsSummary ?? null);
      setExpandedTrendId(null);
      setSelectedTopic(null);
      setLastUpdated(data.batch_ts ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar tendências.';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Persist summary cache across full reloads keyed by batch_ts
  useEffect(() => {
    const stored = sessionStorage.getItem(SUMMARY_CACHE_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          batch_ts: string | null;
          entries: Record<string, { summary: SummaryData; metadata: Record<string, unknown> | null; fromCache: boolean }>;
        };
        persistedBatchRef.current = parsed.batch_ts ?? null;
        if (parsed.entries && typeof parsed.entries === 'object') {
          summaryCacheRef.current.clear();
          Object.entries(parsed.entries).forEach(([key, entry]) => {
            summaryCacheRef.current.set(key, entry);
          });
        }
      } catch {
        sessionStorage.removeItem(SUMMARY_CACHE_STORAGE_KEY);
      }
    }
  }, []);

  const persistSummaryCache = useCallback(() => {
    try {
      const entries: Record<string, { summary: SummaryData; metadata: Record<string, unknown> | null; fromCache: boolean }> =
        {};
      summaryCacheRef.current.forEach((value, key) => {
        entries[key] = value;
      });
      sessionStorage.setItem(
        SUMMARY_CACHE_STORAGE_KEY,
        JSON.stringify({
          batch_ts: persistedBatchRef.current,
          entries,
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    fetchLatestTrends();
  }, [fetchLatestTrends]);

  const handleTrendExpand = (trend: DailyTrend) => {
    setExpandedTrendId((current) => (current === trend.position ? null : trend.position));
    setSelectedTopic(null);
    setSelectedSummary(null);
    setSummaryError(null);
  };

  const renderTrendList = () => (
    <div className="space-y-3">
      {trends.map((trend) => (
        <div key={`${trend.position}-${trend.title}`}>
          <TrendCard
            trend={trend}
            isExpanded={expandedTrendId === trend.position}
            topics={trend.topics ?? null}
            isLoadingTopics={false}
            topicsError={null}
            onExpand={() => handleTrendExpand(trend)}
            onCollapse={() => handleTrendExpand(trend)}
            onTopicSelect={(topic) => {
              setSelectedTopic(topic);
              setSummaryError(null);

              const cachedSummary = summaryCacheRef.current.get(
                createCacheKey(
                  trend.id ?? trend.position ?? trend.title ?? '',
                  topic.id ?? topic.number ?? topic.description ?? '',
                ),
              );

              if (cachedSummary) {
                setSelectedSummary(cachedSummary.summary);
                setSummaryMetadata(cachedSummary.metadata);
                setSummaryFromCache(Boolean(cachedSummary.fromCache));
              } else {
                setSelectedSummary(null);
                setSummaryMetadata(null);
                setSummaryFromCache(false);
              }
            }}
            disabled={isLoading || isRefreshing}
          />
        </div>
      ))}
    </div>
  );

  const renderSummaryContent = (breakpoint: 'mobile' | 'desktop') => {
    const isMobile = breakpoint === 'mobile';
    const contentPadding = isMobile ? 'p-4' : 'p-6';
    const footerPadding = isMobile ? 'px-4 py-3' : 'px-6 py-4';
    const currentTrend = trends.find((trend) => trend.position === expandedTrendId) || null;
    const topicEngagement = selectedTopic ? extractTopicEngagement(selectedTopic) : null;

    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col h-full">
        {isMobile && (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setSelectedTopic(null);
                setSelectedSummary(null);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Voltar para lista"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Voltar</span>
            </button>
          </div>
        )}
        <div className={`flex-1 overflow-y-auto ${contentPadding}`}>
          {selectedTopic ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Tópico #{selectedTopic.number}</span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs font-semibold text-gray-900 mb-1">Comentário</p>
                <p className="text-sm text-gray-800 leading-relaxed">{selectedTopic.description}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="font-semibold text-gray-900">👍 {topicEngagement?.likesLabel ?? 'Não informado'}</span>
                  <span className="text-gray-500">(Likes)</span>
                  <span className="text-gray-400">·</span>
                  <span className="font-semibold text-gray-900">💬 {topicEngagement?.repliesLabel ?? 'Sem dados'}</span>
                  <span className="text-gray-500">(Debates do comentário)</span>
                </div>
                {selectedTopic.posted_at && (
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold text-gray-900">Publicado:</span> {formatDate(selectedTopic.posted_at)}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => currentTrend && fetchSummaryForTopic(currentTrend, selectedTopic)}
                  disabled={isLoadingSummary || !currentTrend}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingSummary ? 'animate-spin' : ''}`} />
                  {selectedSummary ? 'Atualizar resumo' : 'Gerar resumo'}
                </button>
                {summaryFromCache && !isLoadingSummary && (
                  <span className="text-[11px] text-amber-700">Exibindo versão em cache</span>
                )}
              </div>

              {isLoadingSummary && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  Gerando resumo... (pode levar ~45 segundos)
                </div>
              )}
              {summaryError && !isLoadingSummary && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {summaryError}
                </div>
              )}
                {selectedSummary && !isLoadingSummary && !summaryError && (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 space-y-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        {summaryTopicName && (
                          <span className="font-semibold text-gray-900">{summaryTopicName}</span>
                        )}
                        {summaryTrendName && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                            {summaryTrendName}
                          </span>
                        )}
                        {summaryLikesData && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                            {summaryLikesData}
                          </span>
                        )}
                      </div>

                  </div>

                  {summaryContext.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-900 mb-1">Contexto</p>
                      <ul className="space-y-1">
                        {summaryContext.map((item, index) => (
                          <li key={`${index}-${item.slice(0, 10)}`} className="text-xs text-gray-800 leading-relaxed">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-semibold text-gray-900">Resumo</p>
                    {selectedSummary.thesis && (
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed mt-1">
                        {selectedSummary.thesis}
                      </p>
                    )}
                    {!selectedSummary.thesis && selectedSummary.personalization && (
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed mt-1">
                        {selectedSummary.personalization}
                      </p>
                    )}
                  </div>

                  {selectedSummary.personalization && selectedSummary.thesis && (
                    <div>
                      <p className="text-xs font-semibold text-gray-900 mb-1">Personalização</p>
                      <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                        {selectedSummary.personalization}
                      </p>
                    </div>
                  )}

                  {summaryDebate.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-900 mb-1">Pontos de debate</p>
                      <ul className="space-y-1">
                        {summaryDebate.map((item, index) => (
                          <li key={`${index}-${item.slice(0, 10)}`} className="text-xs text-gray-800 leading-relaxed">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(selectedSummary['why-it-matters'] || selectedSummary.whyItMatters) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-900 mb-1">Por que importa</p>
                      <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                        {selectedSummary['why-it-matters'] || selectedSummary.whyItMatters}
                      </p>
                    </div>
                  )}

                  {Array.isArray(selectedSummary.sources) && selectedSummary.sources.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-900 mb-1">Fontes</p>
                      <ul className="space-y-1">
                        {selectedSummary.sources.map((source, index) => (
                          <li key={`${source.url ?? index}`} className="text-xs text-blue-600 underline">
                            <a href={source.url} target="_blank" rel="noopener noreferrer">
                              {source.title || source.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaryTopicsSummary && (
                    <div>
                      <p className="text-xs font-semibold text-gray-900 mb-1">Resumo dos tópicos</p>
                      <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{summaryTopicsSummary}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-gray-500">
              <p>Selecione um tópico para ver detalhes.</p>
            </div>
          )}
        </div>
        <div className={`border-t border-gray-200 bg-gray-50 ${footerPadding} text-xs text-gray-500`}>
          {formatTimestamp ? `Atualizado em ${formatTimestamp}` : 'Aguardando dados recentes...'}
        </div>
      </div>
    );
  };

  const showMobileSummary = Boolean(selectedTopic || selectedSummary);

  useEffect(() => {
    if (showMobileSummary) {
      if (mobileListContainerRef.current) {
        mobileListScrollPosition.current = mobileListContainerRef.current.scrollTop;
      }

      if (mobileSummaryWrapperRef.current) {
        mobileSummaryWrapperRef.current.scrollTo({ top: 0, behavior: 'auto' });
      }
    } else if (mobileListContainerRef.current) {
      mobileListContainerRef.current.scrollTo({
        top: mobileListScrollPosition.current,
        behavior: 'auto',
      });
    }
  }, [showMobileSummary]);

  const handleMobileListScroll = useCallback(() => {
    if (mobileListContainerRef.current) {
      mobileListScrollPosition.current = mobileListContainerRef.current.scrollTop;
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Erro</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button
                onClick={() => fetchLatestTrends({ isRefresh: true })}
                className="mt-2 text-sm text-red-700 font-medium hover:text-red-800"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {isLoading && trends.length === 0 ? (
          <TrendSkeleton />
        ) : trends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <RefreshCw className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Nenhuma tendência disponível</h2>
            <p className="mt-2 text-sm text-gray-600">Tente atualizar para carregar as últimas tendências.</p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => fetchLatestTrends({ isRefresh: true })}
                disabled={isLoading || isRefreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Buscar tendências
              </button>
            </div>
          </div>
        ) : (
          <>
            {trendsSummary && trends.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="text-xs font-semibold text-gray-900">Panorama do Dia</p>
                  {formatTimestamp && (
                    <span className="text-[11px] text-gray-500">(atualizado em {formatTimestamp})</span>
                  )}
                </div>
                <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{trendsSummary}</p>
              </div>
            )}

            <div className="lg:hidden relative overflow-hidden rounded-2xl min-h-[520px]">
              <div
                className={`w-full transition-transform duration-300 ease-in-out ${
                  showMobileSummary ? '-translate-x-full' : 'translate-x-0'
                }`}
              >
                <div
                  ref={mobileListContainerRef}
                  onScroll={handleMobileListScroll}
                  className="space-y-3 pb-8 max-h-[70vh] overflow-y-auto"
                >
                  {renderTrendList()}
                </div>
              </div>
              {showMobileSummary && (
                <div
                  ref={mobileSummaryWrapperRef}
                  className="absolute inset-0 w-full transition-transform duration-300 ease-in-out translate-x-0 overflow-y-auto"
                >
                  {renderSummaryContent('mobile')}
                </div>
              )}
            </div>

            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
              <div className="space-y-3">{renderTrendList()}</div>
              <div>{renderSummaryContent('desktop')}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
