import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { TrendCard } from '../components/tap/TrendCard';
import { TrendSkeleton } from '../components/tap/LoadingProgress';
import { DailyTrend, DailyTrendTopic, DailyTrendsPayload } from '../types/dailyTrends';
import { type DailyTrendsRow, supabase } from '../lib/supabase';
import { safeJsonParse } from '../lib/safeJsonParse';
import { tapNavigationService } from '../lib/tapNavigationService';
import { SummaryData } from '../types/tapNavigation';
import { websocketService } from '../lib/websocket';

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
      timeStyle: 'short',
    }).format(date);
  }, []);

  const getTopicEngagement = useCallback(
    (topic?: DailyTrendTopic | null) => topic?.['likes-data'] ?? topic?.likesData ?? 'Não informado',
    [],
  );

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
        await websocketService.connect();
      } catch (wsError) {
        setIsLoadingSummary(false);
        const sessionErrorCode =
          typeof wsError === 'object' && wsError !== null && 'code' in wsError
            ? (wsError as { code?: unknown }).code
            : undefined;
        const isSessionMissing =
          sessionErrorCode === 'SESSION_MISSING' ||
          (wsError instanceof Error && wsError.message === 'SESSION_MISSING');

        console.error('[TapNavigationPage] WebSocket connection failed', {
          ...startLogContext,
          status: 'connection_failed',
          isSessionMissing,
          connectionState: websocketService.getConnectionState(),
          durationMs: Math.round(performance.now() - startedAt),
          error: wsError,
        });

        setSummaryError(
          isSessionMissing
            ? 'Sessão ausente ou expirada. Atualize a página ou faça login novamente.'
            : 'Não foi possível conectar ao assistente para gerar o resumo.',
        );
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? 'anonymous';

      try {
        const result = await tapNavigationService.fetchSummary(
          Number(topic.number) || Number(topicId) || topic.number,
          Number(trend.position) || Number(trendId) || trend.position,
          userId,
          {
            trendId,
            topicId,
            forceRefresh: options?.forceRefresh,
            correlationId,
          },
        );

        if (result.success && result.data) {
          setSelectedSummary(result.data as SummaryData);
          setSummaryMetadata((result.metadata as Record<string, unknown>) ?? null);
          setSummaryFromCache(Boolean(result.fromCache));
          setSummaryError(result.error ?? null);

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

          const resolvedTrendId = resolveMetadataId(result.metadata, ['trendId', 'trend-id'], trendId);
          const resolvedTopicId = resolveMetadataId(result.metadata, ['topicId', 'topic-id'], topicId);

          console.log('[TapNavigationPage] Summary fetched successfully', {
            event: 'summary_fetch',
            status: 'succeeded' as const,
            correlationId,
            trendId,
            topicId,
            resolvedTrendId,
            resolvedTopicId,
            connectionState: websocketService.getConnectionState(),
            fromCache: Boolean(result.fromCache),
            durationMs: Math.round(performance.now() - startedAt),
            timestamp: startedAtIso,
          });
        } else {
          setSummaryError(result.error || 'Não foi possível obter o resumo.');

          console.error('[TapNavigationPage] Summary fetch failed', {
            event: 'summary_fetch',
            status: 'failed' as const,
            correlationId,
            trendId,
            topicId,
            connectionState: websocketService.getConnectionState(),
            durationMs: Math.round(performance.now() - startedAt),
            error: result.error || 'unknown_error',
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
    [],
  );

  const fetchLatestTrends = useCallback(async (options?: { isRefresh?: boolean }) => {
    const isRefresh = options?.isRefresh ?? false;
    setError(null);
    setIsLoading((prev) => prev || !isRefresh);
    setIsRefreshing(isRefresh);

    try {
      const { data, error: supabaseError } = await supabase
        .from<DailyTrendsRow>('daily_trends')
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
              setSelectedSummary(null);
              setSummaryError(null);
              setSummaryFromCache(false);
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

    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col h-full">
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
                <p>
                  <span className="font-semibold text-gray-900">Engajamento do comentário:</span>{' '}
                  {getTopicEngagement(selectedTopic)}
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Respostas (💬):</span>{' '}
                  {typeof selectedTopic.replies_total === 'number' ? selectedTopic.replies_total : 'Sem dados'}
                </p>
                {selectedTopic.posted_at && (
                  <p>
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

                    {(selectedSummary.thread_id || selectedSummary.comment_id) && (
                      <p className="text-[11px] text-gray-500">
                        {selectedSummary.thread_id && <span>Thread: {selectedSummary.thread_id}</span>}
                        {selectedSummary.thread_id && selectedSummary.comment_id && <span> · </span>}
                        {selectedSummary.comment_id && <span>Comentário: {selectedSummary.comment_id}</span>}
                      </p>
                    )}
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quenty</h1>
            <p className="text-xs text-gray-500">
              Atualizado {formatTimestamp ? `em ${formatTimestamp}` : 'recentemente'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLatestTrends({ isRefresh: true })}
              disabled={isLoading || isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Atualizar tendências"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

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
                <p className="mb-1 text-xs font-semibold text-gray-900">Panorama do Dia</p>
                <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{trendsSummary}</p>
              </div>
            )}

            <div className="lg:hidden relative overflow-hidden rounded-2xl min-h-[520px]">
              <div
                className={`w-full transition-transform duration-300 ease-in-out ${
                  showMobileSummary ? '-translate-x-full' : 'translate-x-0'
                }`}
              >
                <div className="space-y-3 pb-8">{renderTrendList()}</div>
              </div>
              {showMobileSummary && (
                <div className="absolute inset-0 w-full transition-transform duration-300 ease-in-out translate-x-0">
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
