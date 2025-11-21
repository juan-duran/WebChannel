import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { TrendCard } from '../components/tap/TrendCard';
import { TrendSkeleton } from '../components/tap/LoadingProgress';
import { DailyTrend, DailyTrendTopic, DailyTrendsPayload } from '../types/dailyTrends';
import { type DailyTrendsRow, supabase } from '../lib/supabase';
import { safeJsonParse } from '../lib/safeJsonParse';
import { tapNavigationService } from '../lib/tapNavigationService';
import { SummaryData } from '../types/tapNavigation';
import { websocketService, type WebSocketMessage } from '../lib/websocket';
import { fetchSummaryHttpFallback } from '../lib/httpAgent';

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
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryFromCache, setSummaryFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);
  const summaryCorrelationRef = useRef<string | null>(null);

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

  const fetchSummaryForTopic = useCallback(
    async (trend: DailyTrend, topic: DailyTrendTopic, options?: { forceRefresh?: boolean }) => {
      if (summaryAbortRef.current) {
        summaryAbortRef.current.abort();
      }
      const abortController = new AbortController();
      summaryAbortRef.current = abortController;
      setSummaryError(null);
      setSelectedSummary(null);
      setSummaryFromCache(false);
      setIsLoadingSummary(true);
      const correlationId = websocketService.generateCorrelationId();
      summaryCorrelationRef.current = correlationId;

      const trendId = (trend.id ?? trend.position ?? trend.title ?? '').toString();
      const topicId = (topic.id ?? topic.number ?? topic.description ?? '').toString();

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? 'anonymous';

      try {
        // Try WS first
        try {
          await websocketService.connect();
          const result = await tapNavigationService.fetchSummary(
            Number(topic.number) || Number(topicId) || topic.number,
            Number(trend.position) || Number(trendId) || trend.position,
            userId,
            {
              trendId,
              topicId,
              forceRefresh: options?.forceRefresh,
              signal: abortController.signal,
              timeoutMs: 45_000,
              correlationId,
            },
          );

          if (result.success && result.data) {
            setSelectedSummary(result.data as SummaryData);
            setSummaryFromCache(Boolean(result.fromCache));
            setSummaryError(result.error ?? null);
            summaryCorrelationRef.current = null;
            return;
          }
        } catch (wsError) {
          // Fall through to HTTP fallback
        }

        // HTTP fallback
        const httpResult = await fetchSummaryHttpFallback(trendId, topicId);
        if (httpResult.success) {
          const structured = httpResult.structuredData as any;
          if (structured && structured.summary) {
            setSelectedSummary(structured.summary as SummaryData);
            setSummaryFromCache(false);
            setSummaryError(null);
          } else if (httpResult.content) {
            setSelectedSummary({ thesis: httpResult.content });
            setSummaryFromCache(false);
            setSummaryError(null);
          } else {
            setSummaryError('Resumo indisponível (fallback).');
          }
        } else {
          setSummaryError(httpResult.error || 'Resumo indisponível (fallback).');
        }
        summaryCorrelationRef.current = null;

      } catch (err) {
        if (abortController.signal.aborted) {
          setSummaryError('Solicitação cancelada.');
        } else {
          const message = err instanceof Error ? err.message : 'Erro ao obter o resumo.';
          setSummaryError(message);
        }
        summaryCorrelationRef.current = null;
      } finally {
        setIsLoadingSummary(false);
        summaryAbortRef.current = null;
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

  // Listen for assistant summary messages that may arrive asynchronously (e.g., via /api/messages/send)
  useEffect(() => {
    const handleIncoming = (message: WebSocketMessage) => {
      if (message.type !== 'message' || message.role !== 'assistant') return;
      if (message.contentType !== 'summary' && (message as any).content_type !== 'summary') return;

      const incomingCorrelation =
        (message as any).correlation_id ?? message.correlationId ?? (message as any).correlation_id;
      if (
        summaryCorrelationRef.current &&
        incomingCorrelation &&
        incomingCorrelation !== summaryCorrelationRef.current
      ) {
        return;
      }

      const structured = (message.structuredData ?? (message as any).structured_data) as any;
      const summaryPayload =
        structured && typeof structured === 'object'
          ? (structured.summary && typeof structured.summary === 'object' ? structured.summary : structured)
          : null;

      if (summaryPayload && typeof summaryPayload === 'object') {
        const thesis =
          typeof summaryPayload.thesis === 'string'
            ? summaryPayload.thesis
            : typeof summaryPayload.content === 'string'
            ? summaryPayload.content
            : undefined;

        if (thesis || summaryPayload.personalization || summaryPayload['likes-data'] || summaryPayload.likesData) {
          setSelectedSummary({
            thesis: thesis ?? '',
            personalization: summaryPayload.personalization ?? '',
            likesData: summaryPayload['likes-data'] || summaryPayload.likesData || '',
            context: Array.isArray(summaryPayload.context) ? summaryPayload.context : [],
            debate: Array.isArray(summaryPayload.debate) ? summaryPayload.debate : [],
            ...(summaryPayload.whyItMatters || summaryPayload['why_it_matters']
              ? { whyItMatters: summaryPayload.whyItMatters ?? summaryPayload['why_it_matters'] }
              : {}),
            ...(Array.isArray(summaryPayload.sources) ? { sources: summaryPayload.sources } : {}),
            ...(typeof summaryPayload.topicName === 'string' ? { topicName: summaryPayload.topicName } : {}),
          });
          setIsLoadingSummary(false);
          setSummaryError(null);
          summaryCorrelationRef.current = null;
          return;
        }
      }

      if (typeof message.content === 'string' && message.content.trim().length > 0) {
        setSelectedSummary({
          thesis: message.content.trim(),
        });
        setIsLoadingSummary(false);
        setSummaryError(null);
        summaryCorrelationRef.current = null;
      }
    };

    websocketService.on('message', handleIncoming);
    return () => {
      websocketService.off('message', handleIncoming);
    };
  }, []);

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
                  {selectedSummary.likesData && (
                    <p className="text-xs text-gray-500">{selectedSummary.likesData}</p>
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
              <div className="w-full transition-transform duration-300 ease-in-out translate-x-0">
                <div className="space-y-3 pb-8">{renderTrendList()}</div>
              </div>
              <div className="absolute inset-0 w-full transition-transform duration-300 ease-in-out translate-x-0">
                {renderSummaryContent('mobile')}
              </div>
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
