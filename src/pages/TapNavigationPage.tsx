import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, AlertCircle, ArrowLeft, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { TrendCard } from '../components/tap/TrendCard';
import { TrendSkeleton } from '../components/tap/LoadingProgress';
import { DailyTrend, DailyTrendTopic, DailyTrendsPayload } from '../types/dailyTrends';
import { type DailyTrendsRow, type DailyTrendsTable, supabase } from '../lib/supabase';
import { safeJsonParse } from '../lib/safeJsonParse';
import { SummaryData } from '../types/tapNavigation';
import { websocketService } from '../lib/websocket';
import { extractTopicEngagement } from '../utils/topicEngagement';
import { useCurrentUser } from '../state/UserContext';
import { useOnboardingStatus } from '../state/OnboardingStatusContext';
import { trackEvent } from '../lib/analytics';
import { useWebpushStatus } from '../hooks/useWebpushStatus';
import { enableNotifications } from '../lib/pushNotifications';
import { TapInstallAndPushCTA } from '../components/TapInstallAndPushCTA';
import { ProfileSurveyBanner } from '../components/ProfileSurveyBanner';

const sharedSummaryCache = new Map<
  string,
  {
    summary: SummaryData;
    metadata: Record<string, unknown> | null;
    fromCache: boolean;
  }
>();
const SUMMARY_CACHE_STORAGE_KEY = 'tap_summary_cache';
type TapCategory = 'brasil' | 'futebol';

const parseTrendsPayload = (payload: DailyTrendsRow['payload']): DailyTrendsPayload | null => {
  if (!payload) return null;

  if (typeof payload === 'string') {
    return safeJsonParse<DailyTrendsPayload>(payload);
  }

  return payload;
};

const getScrollParent = (node: HTMLElement | null): HTMLElement | Window | null => {
  if (!node) return null;
  let current: HTMLElement | null = node.parentElement;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    current = current.parentElement;
  }
  return window;
};

export function TapNavigationPage() {
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLElement | Window | null>(null);
  const [currentCategory, setCurrentCategory] = useState<TapCategory>('brasil');
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [visibleTrends, setVisibleTrends] = useState<DailyTrend[]>([]);
  const [pendingTrends, setPendingTrends] = useState<DailyTrend[]>([]);
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
  const [summaryStepIndex, setSummaryStepIndex] = useState(0);
  const [summaryBubbleState, setSummaryBubbleState] = useState<'idle' | 'progress' | 'ready'>('idle');
  const [lastSummaryContext, setLastSummaryContext] = useState<{
    category?: TapCategory | null;
    trendPosition?: number | null;
    trendId?: string | number | null;
    topicNumber?: number | null;
    topicId?: string | number | null;
  }>({});
  const [lastSummaryData, setLastSummaryData] = useState<{
    summary: SummaryData;
    metadata: Record<string, unknown> | null;
    fromCache: boolean;
    context: {
      category?: TapCategory | null;
      trendPosition?: number | null;
      trendId?: string | number | null;
      topicNumber?: number | null;
      topicId?: string | number | null;
    };
  } | null>(null);
  const [pendingSummary, setPendingSummary] = useState<{
    summary: SummaryData;
    metadata: Record<string, unknown> | null;
    fromCache: boolean;
    context: {
      category?: TapCategory | null;
      trendPosition?: number | null;
      trendId?: string | number | null;
      topicNumber?: number | null;
      topicId?: string | number | null;
    };
  } | null>(null);
  const [captureStepIndex, setCaptureStepIndex] = useState(0);
  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    const src = params.get('src') || 'direct';
    trackEvent('tap_opened', { src });
  }, []);
  const summarySteps = [
    'QUENTY-IA coletando fontes quentes',
    'Filtrando ruído e lixo',
    'Despolarizando o conteúdo',
  ];
  const captureSteps = [
    'Quenty AI localizando sinais quentes',
    'Filtrando ruído e spam',
    'Despolarizando e organizando',
    'Selecionando os 15 assuntos de agora',
  ];
  const summaryContainerRef = useRef<HTMLDivElement | null>(null);
  const desktopSummaryRef = useRef<HTMLDivElement | null>(null);
  const mobileSummaryTopRef = useRef<HTMLDivElement | null>(null);
  const lastListScrollYRef = useRef(0);
  const selectedTrendRef = useRef<HTMLElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const captureIntervalRef = useRef<number | null>(null);
  const getScrollPosition = useCallback(() => {
    const parent = scrollParentRef.current;
    if (!parent) return 0;
    return parent === window ? window.scrollY : (parent as HTMLElement).scrollTop;
  }, []);

  const scrollToPosition = useCallback((y: number) => {
    const parent = scrollParentRef.current;
    if (!parent) return;
    if (parent === window) {
      window.scrollTo({ top: y, behavior: 'auto' });
    } else {
      (parent as HTMLElement).scrollTo({ top: y, behavior: 'auto' });
    }
  }, []);

  const summaryCacheRef = useRef(sharedSummaryCache);
  const lastBatchRef = useRef<Record<TapCategory, string | null>>({
    brasil: null,
    futebol: null,
  });
  const persistedBatchRef = useRef<Record<TapCategory, string | null>>({
    brasil: null,
    futebol: null,
  });
  const categoryDataRef = useRef<
    Record<
      TapCategory,
      {
        trends: DailyTrend[];
        trendsSummary: string | null;
        lastUpdated: string | null;
      }
    >
  >({
    brasil: { trends: [], trendsSummary: null, lastUpdated: null },
    futebol: { trends: [], trendsSummary: null, lastUpdated: null },
  });

  const mobileListContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileSummaryWrapperRef = useRef<HTMLDivElement | null>(null);
  const mobileListScrollPosition = useRef(0);
  const lastPageScrollRef = useRef(0);
  const { email } = useCurrentUser();
  const onboardingStatus = useOnboardingStatus();
  const { enabled: pushEnabled, refresh: refreshPushStatus } = useWebpushStatus({ auto: false });
  const [tapPushDismissed, setTapPushDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('webpush_asked_on_tap_once') === 'true';
    } catch {
      return false;
    }
  });
  const [tapPushError, setTapPushError] = useState<string | null>(null);
  const [tapPushLoading, setTapPushLoading] = useState(false);

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

  const clearSummaryCacheForCategory = useCallback((category: TapCategory) => {
    const keysToDelete: string[] = [];
    summaryCacheRef.current.forEach((_value, key) => {
      if (key.startsWith(`${category}::`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => summaryCacheRef.current.delete(key));
  }, []);

  useEffect(() => {
    if (pageContainerRef.current) {
      scrollParentRef.current = getScrollParent(pageContainerRef.current);
    }
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

  const createCacheKey = useCallback(
    (
      trendId: string | number | null | undefined,
      topicId: string | number | null | undefined,
      categoryOverride?: TapCategory,
    ) => {
      const normalize = (value: string | number | null | undefined) => {
        if (value === null || value === undefined) return '';
        return String(value).trim();
      };
      const category = categoryOverride ?? currentCategory;

      return `${category}::${normalize(trendId)}::${normalize(topicId)}`;
    },
    [currentCategory],
  );

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

      const cacheKey = createCacheKey(
        trend.id ?? trend.position ?? trend.title ?? '',
        topic.id ?? topic.number ?? topic.description ?? '',
        currentCategory,
      );
      const cachedSummary = summaryCacheRef.current.get(cacheKey);

      if (!options?.forceRefresh && cachedSummary) {
        setSelectedSummary(cachedSummary.summary);
        setSummaryMetadata(cachedSummary.metadata);
        setSummaryFromCache(Boolean(cachedSummary.fromCache));
        setSummaryBubbleState('ready');
        return;
      }

      setSelectedSummary(null);
      setSummaryMetadata(null);
      setSummaryFromCache(false);
      setIsLoadingSummary(true);
      setSummaryStepIndex(0);
      setSummaryBubbleState('progress');
      setPendingSummary(null);

      const trendId = (trend.id ?? trend.position ?? trend.title ?? '').toString();
      const topicId = (topic.id ?? topic.number ?? topic.description ?? '').toString();
      const correlationId = websocketService.generateCorrelationId();
      const startedAt = performance.now();
      const startedAtIso = new Date().toISOString();
      const summaryEndpoint =
        currentCategory === 'futebol' ? '/api/trends/summarize-fut' : '/api/trends/summarize';

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

        trackEvent('summary_request', {
          trend_id: trendId,
          topic_id: topicId,
          category: currentCategory,
        });

        const response = await fetch(summaryEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topicId,
            trendId,
            email,
            forceRefresh: options?.forceRefresh,
            correlationId,
          }),
        });

        if (!response.ok) {
          const message = 'Não foi possível obter o resumo.';
          setSummaryError(message);
          setSummaryBubbleState('idle');
          setPendingSummary(null);

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
          const summaryPayload = {
            summary: normalizedSummary,
            metadata: (data.metadata as Record<string, unknown>) ?? null,
            fromCache: Boolean(data.fromCache),
          };
          const context = {
            category: currentCategory,
            trendPosition: trend.position ?? null,
            trendId: trend.id ?? trend.position ?? trend.title ?? null,
            topicNumber: topic.number ?? null,
            topicId: topic.id ?? topic.number ?? topic.description ?? null,
          };
          const isSameSelection =
            selectedTopic &&
            (selectedTopic.number === topic.number ||
              selectedTopic.id === topic.id ||
              selectedTopic.description === topic.description) &&
            expandedTrendId === trend.position;

          setLastSummaryData({ ...summaryPayload, context });
          setLastSummaryContext({ ...context, category: currentCategory });

          if (isSameSelection) {
            setSelectedSummary(summaryPayload.summary);
            setSummaryMetadata(summaryPayload.metadata);
            setSummaryFromCache(summaryPayload.fromCache);
            setPendingSummary(null);
          } else {
            setPendingSummary({ ...summaryPayload, context });
          }

          setSummaryBubbleState('ready');

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

      const cacheKey = createCacheKey(resolvedTrendId, resolvedTopicId, currentCategory);
      const fallbackCacheKey = createCacheKey(trendId, topicId, currentCategory);

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
      setSummaryBubbleState('idle');
      setPendingSummary(null);

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
    [createCacheKey, email, normalizeSummaryPayload, currentCategory],
  );

  const fetchLatestTrends = useCallback(
    async (category: TapCategory, options?: { isRefresh?: boolean }) => {
      const isRefresh = options?.isRefresh ?? false;
      setError(null);
      setIsLoading((prev) => prev || !isRefresh);
      setIsRefreshing(isRefresh);
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }

      const tableName: DailyTrendsTable = category === 'futebol' ? 'daily_futebol' : 'daily_trends';

      try {
        const { data, error: supabaseError } = await supabase
          .from<DailyTrendsTable, DailyTrendsRow>(tableName)
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

        if (lastBatchRef.current[category] && lastBatchRef.current[category] !== data.batch_ts) {
          clearSummaryCacheForCategory(category);
        }
        lastBatchRef.current[category] = data.batch_ts ?? null;
        persistedBatchRef.current[category] = data.batch_ts ?? null;

        const nextTrends = Array.isArray(parsed.trends) ? parsed.trends : [];
        categoryDataRef.current[category] = {
          trends: nextTrends,
          trendsSummary: parsed.trendsSummary ?? null,
          lastUpdated: data.batch_ts ?? null,
        };

        setTrends(nextTrends);
        setVisibleTrends([]);
        setPendingTrends(nextTrends);
        setTrendsSummary(parsed.trendsSummary ?? null);
        setExpandedTrendId(null);
        setSelectedTopic(null);
        setSelectedSummary(null);
        setSummaryMetadata(null);
        setSummaryFromCache(false);
        setSummaryBubbleState('idle');
        setLastUpdated(data.batch_ts ?? null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar tendências.';
        setError(message);
        setVisibleTrends([]);
        setPendingTrends([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [clearSummaryCacheForCategory],
  );

  // Persist summary cache across full reloads keyed by batch_ts
  useEffect(() => {
    const stored = sessionStorage.getItem(SUMMARY_CACHE_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          batches?: Record<TapCategory, string | null>;
          batch_ts?: string | null;
          entries: Record<string, { summary: SummaryData; metadata: Record<string, unknown> | null; fromCache: boolean }>;
        };
        if (parsed.batches) {
          persistedBatchRef.current = {
            brasil: parsed.batches.brasil ?? null,
            futebol: parsed.batches.futebol ?? null,
          };
        } else if (parsed.batch_ts !== undefined) {
          persistedBatchRef.current = { brasil: parsed.batch_ts, futebol: null };
        }
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
          batches: persistedBatchRef.current,
          entries,
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const cached = categoryDataRef.current[currentCategory];
    if (cached?.trends.length > 0) {
      setTrends(cached.trends);
      setTrendsSummary(cached.trendsSummary);
      setLastUpdated(cached.lastUpdated ?? null);
      setVisibleTrends([]);
      setPendingTrends(cached.trends);
      setExpandedTrendId(null);
      setSelectedTopic(null);
      setSelectedSummary(null);
      setSummaryMetadata(null);
      setSummaryFromCache(false);
      setSummaryBubbleState('idle');
    } else {
      fetchLatestTrends(currentCategory);
    }
  }, [currentCategory, fetchLatestTrends]);

  // Gradually reveal pending trends to emphasize real-time capture
  useEffect(() => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    if (pendingTrends.length === 0) {
      return undefined;
    }

    const [nextTrend, ...remaining] = pendingTrends;
    const delay = 2000 + Math.random() * 4000;

    revealTimerRef.current = window.setTimeout(() => {
      setVisibleTrends((prev) => [...prev, nextTrend]);
      setPendingTrends(remaining);
    }, delay);

    return () => {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [pendingTrends]);

  // Rotate capture steps while revealing
  useEffect(() => {
    if (captureIntervalRef.current) {
      window.clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }

    if (pendingTrends.length === 0) {
      setCaptureStepIndex(0);
      return undefined;
    }

    captureIntervalRef.current = window.setInterval(() => {
      setCaptureStepIndex((prev) => (prev + 1) % captureSteps.length);
    }, 2800);

    return () => {
      if (captureIntervalRef.current) {
        window.clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    };
  }, [pendingTrends.length, captureSteps.length]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
      }
      if (captureIntervalRef.current) {
        window.clearInterval(captureIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let interval: number | undefined;

    if (isLoadingSummary) {
      interval = window.setInterval(() => {
        setSummaryStepIndex((prev) => {
          const next = prev + 1;
          return next >= summarySteps.length ? summarySteps.length - 1 : next;
        });
      }, 9000);
    }

    return () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
    };
  }, [isLoadingSummary, summarySteps.length]);

  useEffect(() => {
    if (!isLoadingSummary && summaryBubbleState === 'progress' && selectedSummary) {
      setSummaryBubbleState('ready');
    }
    if (!isLoadingSummary && summaryError) {
      setSummaryBubbleState('idle');
    }
  }, [isLoadingSummary, summaryError, selectedSummary, summaryBubbleState]);

  useEffect(() => {
    if (!tapPushDismissed) {
      refreshPushStatus();
    }
  }, [tapPushDismissed, refreshPushStatus]);

  const dismissTapPush = useCallback(() => {
    setTapPushDismissed(true);
    try {
      localStorage.setItem('webpush_asked_on_tap_once', 'true');
    } catch {
      // ignore
    }
  }, []);

  const handleTapEnablePush = useCallback(async () => {
    setTapPushLoading(true);
    setTapPushError(null);
    try {
      await enableNotifications();
      await refreshPushStatus();
      setTapPushDismissed(true);
      try {
        localStorage.setItem('webpush_asked_on_tap_once', 'true');
      } catch {
        // ignore
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível ativar notificações.';
      setTapPushError(message);
    } finally {
      setTapPushLoading(false);
    }
  }, [refreshPushStatus]);

  const pushPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'default';
  const showTapPushCta =
    !tapPushDismissed && (pushEnabled === false || pushPermission !== 'granted');
  const totalTrends = trends.length;
  const revealedCount = visibleTrends.length;
  const isRevealingTrends = pendingTrends.length > 0;

  // Auto-apply a pending summary if the user is still on the same trend/topic when it arrives.
  useEffect(() => {
    if (!pendingSummary) return;
    const ctx = pendingSummary.context;
    if (!ctx) return;

    const matchesCategory = !ctx.category || ctx.category === currentCategory;
    if (!matchesCategory) return;

    const matchesTrend =
      (typeof ctx.trendPosition === 'number' && ctx.trendPosition === expandedTrendId) ||
      (ctx.trendId &&
        trends.some(
          (t) =>
            (t.position === expandedTrendId ||
              t.id === expandedTrendId ||
              t.title === expandedTrendId) &&
            (t.id === ctx.trendId || t.title === ctx.trendId || t.position === ctx.trendPosition),
        ));

    const matchesTopic =
      !selectedTopic ||
      (ctx.topicNumber === selectedTopic.number ||
        ctx.topicId === selectedTopic.id ||
        ctx.topicId === selectedTopic.description);

    if (matchesTrend && matchesTopic) {
      setSelectedSummary(pendingSummary.summary);
      setSummaryMetadata(pendingSummary.metadata);
      setSummaryFromCache(pendingSummary.fromCache);
      setPendingSummary(null);
      setSummaryBubbleState('ready');
    }
  }, [pendingSummary, expandedTrendId, selectedTopic, trends, currentCategory]);

  const handleTrendExpand = (trend: DailyTrend) => {
    setExpandedTrendId((current) => {
      const next = current === trend.position ? null : trend.position;
      if (next !== null && next !== current) {
        trackEvent('trend_expand', {
          trend_position: trend.position,
          trend_id: trend.id ?? trend.position,
        });
      }
      return next;
    });
    setSelectedTopic(null);
    setSelectedSummary(null);
    setSummaryError(null);
  };

  const renderTrendList = () => (
    <div className="space-y-3">
      {visibleTrends.map((trend) => (
        <div
          key={`${trend.position}-${trend.title}`}
          ref={(el) => {
            if (expandedTrendId === trend.position) {
              selectedTrendRef.current = el;
            }
          }}
        >
          <TrendCard
            trend={trend}
            isExpanded={expandedTrendId === trend.position}
            topics={trend.topics ?? null}
            isLoadingTopics={false}
            topicsError={null}
            onExpand={() => handleTrendExpand(trend)}
            onCollapse={() => handleTrendExpand(trend)}
            onTopicSelect={(topic) => {
              const isSameTopic =
                expandedTrendId === trend.position &&
                selectedTopic &&
                (selectedTopic.number === topic.number ||
                  selectedTopic.id === topic.id ||
                  selectedTopic.description === topic.description);

              if (isSameTopic && typeof window !== 'undefined' && window.innerWidth >= 1024) {
                setSelectedTopic(null);
                setSelectedSummary(null);
                setSummaryMetadata(null);
                setSummaryFromCache(false);
                setSummaryError(null);
                return;
              }

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
            renderTopicExtras={(topic) => {
              const isSelectedTopic =
                selectedTopic &&
                (selectedTopic.number === topic.number ||
                  selectedTopic.id === topic.id ||
                  selectedTopic.description === topic.description);

              if (!isSelectedTopic || expandedTrendId !== trend.position) return null;

              return (
                <div
                  className="mt-3 hidden lg:block"
                  ref={summaryContainerRef}
                  onClick={(event) => event.stopPropagation()}
                >
                  {renderSummaryContent('desktop', trend)}
                </div>
              );
            }}
            disabled={isLoading || isRefreshing}
          />
        </div>
      ))}
    </div>
  );

  const renderSummaryProgress = () => (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-900 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
        <Loader2 className="w-4 h-4 animate-spin" />
        QUENTY-IA em ação (pode levar ~1–2 minutos)
      </div>
      <ul className="space-y-1.5">
        {summarySteps.map((step, idx) => {
          const active = idx === summaryStepIndex;
          const done = idx < summaryStepIndex;
          return (
            <li
              key={step}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
                active ? 'bg-white border border-blue-200' : done ? 'text-blue-700' : 'text-blue-900/80'
              }`}
            >
              {done ? (
                <CheckCircle className="w-4 h-4 text-blue-600" />
              ) : active ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-blue-200" />
              )}
              <span className="text-[12px]">{step}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const scrollToSummary = () => {
    if (summaryContainerRef.current) {
      summaryContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (mobileSummaryWrapperRef.current) {
      mobileSummaryWrapperRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderSummaryBubble = () => {
    if (summaryBubbleState === 'idle') return null;

    const isReady = summaryBubbleState === 'ready';
    const handleClick = () => {
      if (isReady && (lastSummaryContext.trendPosition || lastSummaryContext.trendId)) {
        const targetTrend =
          trends.find((t) => t.position === lastSummaryContext.trendPosition) ||
          trends.find((t) => (t.id ?? t.title) === lastSummaryContext.trendId) ||
          trends.find((t) => t.position === expandedTrendId) ||
          null;

        if (targetTrend) {
          setExpandedTrendId(targetTrend.position ?? null);

          const matchTopic =
            targetTrend.topics?.find(
              (topic) =>
                topic.number === lastSummaryContext.topicNumber ||
                topic.id === lastSummaryContext.topicId ||
                topic.description === lastSummaryContext.topicId,
            ) || targetTrend.topics?.[0] || null;

          setSelectedTopic(matchTopic ?? null);
          const matchesContext = (
            ctx:
              | {
                  category?: TapCategory | null;
                  trendPosition?: number | null;
                  trendId?: string | number | null;
                  topicNumber?: number | null;
                  topicId?: string | number | null;
                }
              | null
          ) =>
            Boolean(
              ctx &&
                (!ctx.category || ctx.category === currentCategory) &&
                (ctx.trendPosition === targetTrend.position ||
                  (ctx.trendId && (ctx.trendId === targetTrend.id || ctx.trendId === targetTrend.title))) &&
                (ctx.topicNumber === matchTopic?.number ||
                  ctx.topicId === matchTopic?.id ||
                  ctx.topicId === matchTopic?.description ||
                  matchTopic === null), // tolerate missing topic match and still apply summary
            );

          const applySummary = (payload: typeof pendingSummary | typeof lastSummaryData | null) => {
            if (!payload) return false;
            setSelectedSummary(payload.summary);
            setSummaryMetadata(payload.metadata);
            setSummaryFromCache(payload.fromCache);
            return true;
          };

          if (matchesContext(pendingSummary?.context) && applySummary(pendingSummary)) {
            setPendingSummary(null);
          } else if (matchesContext(lastSummaryData?.context) && applySummary(lastSummaryData)) {
            // keep lastSummaryData for future clicks
          }
          setTimeout(() => scrollToSummary(), 100);
          return;
        }
      }

      scrollToSummary();
    };
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`fixed right-4 bottom-20 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-colors lg:right-6 lg:bottom-6 ${
          isReady
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-amber-500 text-white hover:bg-amber-600'
        }`}
      >
        {isReady ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        <span className="text-sm font-semibold">
          {isReady ? 'Resumo pronto — abrir' : 'Resumo em preparo (QUENTY-IA)'}
        </span>
      </button>
    );
  };

  const renderCaptureBubble = () => {
    if (!isRevealingTrends) return null;

    return (
      <div className="fixed right-4 bottom-36 z-40 flex max-w-xs items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/95 px-3 py-3 shadow-lg backdrop-blur lg:right-6 lg:bottom-24">
        <Loader2 className="w-4 h-4 animate-spin text-blue-700 mt-0.5" />
        <div className="flex-1 space-y-1 text-xs text-blue-800">
          <p className="font-semibold text-blue-900">Quenty AI capturando em tempo real…</p>
          <p className="text-[12px] text-blue-800">{captureSteps[captureStepIndex] ?? captureSteps[0]}</p>
          {totalTrends > 0 && (
            <p className="text-[11px] text-blue-700">
              {revealedCount}/{totalTrends} assuntos prontos
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderSummaryContent = (breakpoint: 'mobile' | 'desktop', currentTrendOverride?: DailyTrend | null) => {
    const isMobile = breakpoint === 'mobile';
    const contentPadding = isMobile ? 'p-4' : 'p-6';
    const footerPadding = isMobile ? 'px-4 py-3' : 'px-6 py-4';
    const currentTrend =
      (currentTrendOverride ?? trends.find((trend) => trend.position === expandedTrendId)) || null;
    const topicEngagement = selectedTopic ? extractTopicEngagement(selectedTopic) : null;
    const hasCachedSummary = summaryFromCache && Boolean(selectedSummary);

    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col h-full">
        {isMobile && (
          <div
            ref={mobileSummaryTopRef}
            className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 scroll-mt-24"
          >
            <button
              type="button"
              onClick={() => {
                const savedY = getScrollPosition();
                setSelectedTopic(null);
                setSelectedSummary(null);
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    scrollToPosition(Math.max(0, savedY));
                    selectedTrendRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
                  });
                });
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Voltar para lista"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Voltar</span>
            </button>
          </div>
        )}
        <div ref={!isMobile ? desktopSummaryRef : undefined} className={`flex-1 overflow-y-auto ${contentPadding}`}>
          {selectedTopic ? (
            <div className="space-y-3">
              {isMobile && (
                <>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">
                      Assunto #{currentTrend?.position ?? '?'} — {currentTrend?.title ?? 'Assunto'} — Tópico #
                      {selectedTopic.number}
                    </span>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-xs font-semibold text-gray-900 mb-1">Comentário</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{selectedTopic.description}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <span className="font-semibold text-gray-900">
                        👍 {topicEngagement?.likesLabel ?? 'Não informado'}
                      </span>
                      <span className="text-gray-500">(Likes)</span>
                      <span className="text-gray-400">·</span>
                      <span className="font-semibold text-gray-900">
                        💬 {topicEngagement?.repliesLabel ?? 'Sem dados'}
                      </span>
                      <span className="text-gray-500">(Debates do comentário)</span>
                    </div>
                    {selectedTopic.posted_at && (
                      <p className="text-xs text-gray-600">
                        <span className="font-semibold text-gray-900">Publicado:</span> {formatDate(selectedTopic.posted_at)}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                {!hasCachedSummary && (
                  <button
                    type="button"
                    onClick={() => currentTrend && fetchSummaryForTopic(currentTrend, selectedTopic)}
                    disabled={isLoadingSummary || !currentTrend}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingSummary ? 'animate-spin' : ''}`} />
                    Gerar resumo
                  </button>
                )}
                {hasCachedSummary && (
                  <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                    <CheckCircle className="w-3 h-3" />
                    Resumo em cache
                    <button
                      type="button"
                      onClick={() =>
                        currentTrend && fetchSummaryForTopic(currentTrend, selectedTopic, { forceRefresh: true })
                      }
                      className="ml-1 text-blue-600 hover:text-blue-700 underline"
                    >
                      Reprocessar
                    </button>
                  </div>
                )}
              </div>

              {isLoadingSummary && renderSummaryProgress()}
              {summaryError && !isLoadingSummary && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {summaryError}
                </div>
              )}
              {selectedSummary && !isLoadingSummary && !summaryError && (
                <div
                  ref={summaryContainerRef}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 space-y-3"
                >
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
        {isMobile && (
          <div className={`border-t border-gray-200 bg-gray-50 ${footerPadding} text-xs text-gray-500`}>
            {formatTimestamp ? `Atualizado em ${formatTimestamp}` : 'Aguardando dados recentes...'}
          </div>
        )}
      </div>
    );
  };

  const showMobileSummary = Boolean(selectedTopic || selectedSummary);

  useEffect(() => {
    if (showMobileSummary) {
      if (mobileListContainerRef.current) {
        mobileListScrollPosition.current = mobileListContainerRef.current.scrollTop;
      }
      lastListScrollYRef.current = getScrollPosition();
      if (typeof window !== 'undefined') {
        lastPageScrollRef.current = window.scrollY;
      }

      if (mobileSummaryWrapperRef.current) {
        mobileSummaryWrapperRef.current.scrollTo({ top: 0, behavior: 'auto' });
      }
      // Bring the summary into view on mobile so it starts at the top (CTA "Voltar")
      if (mobileSummaryTopRef.current) {
        const scrollToAnchor = () => {
          mobileSummaryTopRef.current?.scrollIntoView({
            behavior: 'auto',
            block: 'start',
          });
        };
        // Two ticks to avoid shifts from reveal animations/layout
        requestAnimationFrame(() => {
          requestAnimationFrame(scrollToAnchor);
        });
      }
    }
  }, [showMobileSummary]);

  const handleMobileListScroll = useCallback(() => {
    if (mobileListContainerRef.current) {
      mobileListScrollPosition.current = mobileListContainerRef.current.scrollTop;
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" ref={pageContainerRef}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {showTapPushCta && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold text-gray-900">
                  Ative as notificações para receber seu resumo diário.
                </p>
                <p className="text-xs text-gray-700">
                  Sem notificações ativas não conseguimos entregar as 15 notícias do dia para você. Habilite o alerta do navegador para ser avisado assim que o resumo ficar pronto.
                </p>
                {tapPushError && <p className="text-xs text-red-700">{tapPushError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleTapEnablePush}
                    disabled={tapPushLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {tapPushLoading ? 'Ativando...' : 'Ativar notificações'}
                  </button>
                  <button
                    type="button"
                    onClick={dismissTapPush}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                  >
                    Agora não
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Erro</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button
                onClick={() => fetchLatestTrends(currentCategory, { isRefresh: true })}
                className="mt-2 text-sm text-red-700 font-medium hover:text-red-800"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(['brasil', 'futebol'] as TapCategory[]).map((cat) => {
            const isActive = currentCategory === cat;
            const label = cat === 'futebol' ? 'Futebol' : 'Brasil';
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  if (cat !== currentCategory) {
                    setCurrentCategory(cat);
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {isLoading && revealedCount === 0 && totalTrends === 0 ? (
          <TrendSkeleton />
        ) : !isLoading && revealedCount === 0 && !isRevealingTrends && totalTrends === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <RefreshCw className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Nenhuma tendência disponível</h2>
            <p className="mt-2 text-sm text-gray-600">Tente atualizar para carregar as últimas tendências.</p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => fetchLatestTrends(currentCategory, { isRefresh: true })}
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

            <TapInstallAndPushCTA />

            <div className="mt-3 mb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Assuntos mais quentes nas redes sociais hoje
              </h2>
            </div>

              <div className="lg:hidden relative overflow-hidden rounded-2xl min-h-[520px]">
                <div
                  className={`w-full transition-transform duration-300 ease-in-out ${
                    showMobileSummary ? '-translate-x-full' : 'translate-x-0'
                  }`}
                >
                  <div
                    ref={mobileListContainerRef}
                    onScroll={handleMobileListScroll}
                    className="space-y-3 pb-8"
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

            <div className="hidden lg:block">{renderTrendList()}</div>

            {!isRevealingTrends && totalTrends > 0 && revealedCount === totalTrends && (
              <div className="mt-6">
                <ProfileSurveyBanner />
              </div>
            )}
          </>
        )}
      </div>
      {renderCaptureBubble()}
      {renderSummaryBubble()}
      {!onboardingStatus.loading && !onboardingStatus.complete && (
        <div className="fixed inset-0 z-40 bg-white/70 backdrop-blur-[2px] flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-white border border-blue-100 shadow-xl rounded-2xl p-6 space-y-3 text-center">
            <div className="flex justify-center">
              <AlertCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Finalize sua personalização</h2>
            <p className="text-sm text-gray-700">
              Para explorar os Assuntos Quentes do dia, conclua primeiro a personalização do Quenty AI. Assim
              ajustamos exemplos, linguagem e debates ao seu contexto.
            </p>
            <button
              type="button"
              onClick={() => {
                window.history.pushState(null, '', '/onboarding');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Ir para Personalização
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
