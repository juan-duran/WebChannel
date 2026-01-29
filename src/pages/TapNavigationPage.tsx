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
type TapCategory = 'brasil' | 'futebol' | 'fofocas';
type TrendSummaryState = {
  topic: DailyTrendTopic | null;
  summary: SummaryData | null;
  metadata: Record<string, unknown> | null;
  fromCache: boolean;
  isLoading: boolean;
  error: string | null;
};
const TABS: { key: TapCategory; label: string }[] = [
  { key: 'brasil', label: 'Brasil' },
  { key: 'futebol', label: 'Futebol' },
  { key: 'fofocas', label: 'Fofocas' },
];

const parseTrendsPayload = (payload: DailyTrendsRow['payload']): DailyTrendsPayload | null => {
  if (!payload) return null;

  if (typeof payload === 'string') {
    return safeJsonParse<DailyTrendsPayload>(payload);
  }

  return payload;
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
  const [fofocasActiveTrendKey, setFofocasActiveTrendKey] = useState<string | null>(null);
  const [fofocasSummaries, setFofocasSummaries] = useState<Record<string, TrendSummaryState>>({});
  const [futebolActiveTrendKey, setFutebolActiveTrendKey] = useState<string | null>(null);
  const [futebolSummaries, setFutebolSummaries] = useState<Record<string, TrendSummaryState>>({});
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
  const fofocasSummaryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const futebolSummaryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const desktopSummaryRef = useRef<HTMLDivElement | null>(null);
  const mobileSummaryTopRef = useRef<HTMLDivElement | null>(null);
  const lastListScrollYRef = useRef(0);
  const selectedTrendRef = useRef<HTMLElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const captureIntervalRef = useRef<number | null>(null);
  const getScrollPosition = useCallback(
    (parent?: HTMLElement | Window | null) => {
      const target = parent ?? scrollParentRef.current;
      if (!target) return 0;
      if (target === window) return typeof window !== 'undefined' ? window.scrollY : 0;
      return (target as HTMLElement).scrollTop;
    },
    [],
  );

  const scrollToPosition = useCallback((y: number, parent?: HTMLElement | Window | null) => {
    const target = parent ?? scrollParentRef.current;
    if (!target) return;
    if (target === window) {
      if (typeof window !== 'undefined') window.scrollTo({ top: y, behavior: 'auto' });
    } else {
      (target as HTMLElement).scrollTo({ top: y, behavior: 'auto' });
    }
  }, []);

  const summaryCacheRef = useRef(sharedSummaryCache);
  const lastBatchRef = useRef<Record<TapCategory, string | null>>({
    brasil: null,
    futebol: null,
    fofocas: null,
  });
  const persistedBatchRef = useRef<Record<TapCategory, string | null>>({
    brasil: null,
    futebol: null,
    fofocas: null,
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
    fofocas: { trends: [], trendsSummary: null, lastUpdated: null },
  });

  const mobileListContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileSummaryWrapperRef = useRef<HTMLDivElement | null>(null);
  const mobileListScrollPosition = useRef(0);
  const lastPageScrollRef = useRef(0);
  const lastScrollBeforeSummaryRef = useRef(0);
  const lastAnchorYRef = useRef(0);
  const trendElementRefs = useRef<Record<number, HTMLElement | null>>({});
  const resolveScrollContext = useCallback((anchor?: HTMLElement | null) => {
    if (typeof window === 'undefined') {
      return {
        parent: null,
        parentLabel: 'window',
        parentOffset: 0,
        windowOffset: 0,
        documentOffset: 0,
        bodyOffset: 0,
      };
    }

    type ScrollCandidate = {
      node: HTMLElement | Window;
      label: string;
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
    };

    const seen = new Set<HTMLElement | Window>();
    const candidates: ScrollCandidate[] = [];

    const addCandidate = (node: HTMLElement | Window | null | undefined, label: string) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      let scrollTop = 0;
      let scrollHeight = 0;
      let clientHeight = 0;

      if (node === window) {
        scrollTop = window.scrollY;
        scrollHeight = document.documentElement?.scrollHeight ?? 0;
        clientHeight = window.innerHeight;
      } else {
        const el = node as HTMLElement;
        scrollTop = el.scrollTop;
        scrollHeight = el.scrollHeight;
        clientHeight = el.clientHeight;
      }

      candidates.push({ node, label, scrollTop, scrollHeight, clientHeight });
    };

    addCandidate(window, 'window');
    addCandidate(document.scrollingElement as HTMLElement | null, 'document.scrollingElement');
    addCandidate(document.documentElement, 'documentElement');
    addCandidate(document.body, 'body');

    let current: HTMLElement | null = anchor ?? pageContainerRef.current;
    while (current) {
      addCandidate(current, current.tagName);
      current = current.parentElement;
    }

    const scrollable = candidates.filter((c) => c.scrollHeight - c.clientHeight > 4);
    const scrolled = scrollable.filter((c) => c.scrollTop > 1);
    const selected =
      scrolled.sort((a, b) => b.scrollTop - a.scrollTop)[0] ??
      scrollable[0] ??
      candidates[0];

    const parent = selected?.node ?? window;
    const parentLabel = selected?.label ?? 'window';
    const parentOffset = selected?.scrollTop ?? 0;
    const windowOffset = window.scrollY ?? 0;
    const documentOffset = document.documentElement?.scrollTop ?? 0;
    const bodyOffset = document.body?.scrollTop ?? 0;

    return { parent, parentLabel, parentOffset, windowOffset, documentOffset, bodyOffset, candidates };
  }, []);
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
    const { parent } = resolveScrollContext();
    scrollParentRef.current = parent;
  }, [resolveScrollContext]);

  const getTrendKey = useCallback((trend: DailyTrend | null | undefined) => {
    // For fofocas and futebol, always use position as it's guaranteed unique
    if (currentCategory === 'fofocas') {
      return `fof-${trend?.position ?? 'unknown'}`;
    }
    if (currentCategory === 'futebol') {
      return `fut-${trend?.position ?? 'unknown'}`;
    }
    const raw = trend?.id ?? trend?.position ?? trend?.title ?? '';
    return String(raw);
  }, [currentCategory]);

  const createEmptyTrendState = useCallback(
    (topic?: DailyTrendTopic | null): TrendSummaryState => ({
      topic: topic ?? null,
      summary: null,
      metadata: null,
      fromCache: false,
      isLoading: false,
      error: null,
    }),
    [],
  );

  const updateFofocasSummary = useCallback(
    (trendKey: string, updater: (prev: TrendSummaryState) => TrendSummaryState) => {
      setFofocasSummaries((prev) => {
        const base = prev[trendKey] ?? createEmptyTrendState();
        const next = updater(base);
        if (next === base) return prev;
        return { ...prev, [trendKey]: next };
      });
    },
    [createEmptyTrendState],
  );

  const updateFutebolSummary = useCallback(
    (trendKey: string, updater: (prev: TrendSummaryState) => TrendSummaryState) => {
      setFutebolSummaries((prev) => {
        const base = prev[trendKey] ?? createEmptyTrendState();
        const next = updater(base);
        if (next === base) return prev;
        return { ...prev, [trendKey]: next };
      });
    },
    [createEmptyTrendState],
  );

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
    async (trend: DailyTrend, topic?: DailyTrendTopic | null, options?: { forceRefresh?: boolean }) => {
      setSummaryError(null);

      const isFofocas = currentCategory === 'fofocas';
      const isFutebol = currentCategory === 'futebol';
      const isTrendLevelSummary = isFofocas || isFutebol;
      const trendKey = getTrendKey(trend);

      if (!isTrendLevelSummary && !topic) {
        setSummaryError('Selecione um tópico para gerar o resumo.');
        return;
      }

      // For fofocas/futebol, use thread id (trend.id) so the AI agent can look up the correct thread
      // For caching we still use position (via getTrendKey), but the API needs the actual thread_id
      const trendId = (isTrendLevelSummary
        ? (trend.id ?? trend.position ?? trend.title ?? '')
        : (trend.id ?? trend.position ?? trend.title ?? '')
      ).toString();
      const topicIdRaw = topic?.id ?? topic?.number ?? topic?.description ?? trendId;
      const topicId = topicIdRaw.toString();
      const cacheKey = createCacheKey(
        trendId,
        isTrendLevelSummary ? trendId : topicIdRaw,
        currentCategory,
      );
      const cachedSummary = summaryCacheRef.current.get(cacheKey);

      if (!options?.forceRefresh && cachedSummary) {
        if (isFofocas) {
          updateFofocasSummary(trendKey, (prev) => ({
            ...prev,
            topic: topic ?? null,
            summary: cachedSummary.summary,
            metadata: cachedSummary.metadata,
            fromCache: Boolean(cachedSummary.fromCache),
            isLoading: false,
            error: null,
          }));
        } else if (isFutebol) {
          updateFutebolSummary(trendKey, (prev) => ({
            ...prev,
            topic: topic ?? null,
            summary: cachedSummary.summary,
            metadata: cachedSummary.metadata,
            fromCache: Boolean(cachedSummary.fromCache),
            isLoading: false,
            error: null,
          }));
        } else {
          setSelectedSummary(cachedSummary.summary);
          setSummaryMetadata(cachedSummary.metadata);
          setSummaryFromCache(Boolean(cachedSummary.fromCache));
        }
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

      if (isFofocas) {
        updateFofocasSummary(trendKey, (prev) => ({
          ...prev,
          topic: topic ?? null,
          summary: null,
          metadata: null,
          fromCache: false,
          isLoading: true,
          error: null,
        }));
      } else if (isFutebol) {
        updateFutebolSummary(trendKey, (prev) => ({
          ...prev,
          topic: topic ?? null,
          summary: null,
          metadata: null,
          fromCache: false,
          isLoading: true,
          error: null,
        }));
      }

      const correlationId = websocketService.generateCorrelationId();
      const startedAt = performance.now();
      const startedAtIso = new Date().toISOString();
      const summaryEndpoint =
        currentCategory === 'futebol'
          ? '/api/trends/summarize-fut'
          : currentCategory === 'fofocas'
            ? '/api/trends/summarize-fof'
            : '/api/trends/summarize';

      const startLogContext = {
        event: 'summary_fetch',
        status: 'started' as const,
        correlationId,
        trendId,
        topicId: topicId || null,
        forceRefresh: options?.forceRefresh ?? false,
        connectionState: websocketService.getConnectionState(),
        timestamp: startedAtIso,
      };

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
          trendId,
            ...(isTrendLevelSummary ? {} : { topicId }),
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
          if (isFofocas) {
            updateFofocasSummary(trendKey, (prev) => ({
              ...prev,
              isLoading: false,
              summary: null,
              metadata: null,
              error: message,
            }));
          } else if (isFutebol) {
            updateFutebolSummary(trendKey, (prev) => ({
              ...prev,
              isLoading: false,
              summary: null,
              metadata: null,
              error: message,
            }));
          }

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
            topicNumber: topic?.number ?? null,
            topicId: topicId || topic?.id || topic?.number || topic?.description || null,
          };
          const isSameSelection =
            (isTrendLevelSummary
              ? expandedTrendId === trend.position
              : selectedTopic &&
                (selectedTopic.number === topic?.number ||
                  selectedTopic.id === topic?.id ||
                  selectedTopic.description === topic?.description) &&
                expandedTrendId === trend.position);

          setLastSummaryData({ ...summaryPayload, context });
          setLastSummaryContext({ ...context, category: currentCategory });

          // For trend-level summaries (fofocas/futebol), ALWAYS update the trend state
          // because each trend maintains its own summary state independent of selection
          if (isFofocas) {
            updateFofocasSummary(trendKey, (prev) => ({
              ...prev,
              topic: topic ?? null,
              summary: summaryPayload.summary,
              metadata: summaryPayload.metadata,
              fromCache: summaryPayload.fromCache,
              isLoading: false,
              error: null,
            }));
            setPendingSummary(null);
          } else if (isFutebol) {
            updateFutebolSummary(trendKey, (prev) => ({
              ...prev,
              topic: topic ?? null,
              summary: summaryPayload.summary,
              metadata: summaryPayload.metadata,
              fromCache: summaryPayload.fromCache,
              isLoading: false,
              error: null,
            }));
            setPendingSummary(null);
          } else if (isSameSelection) {
            // For topic-based summaries (brasil), only update if still on same selection
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
          const resolvedTopicId = resolveMetadataId(data.metadata, ['topicId', 'topic-id'], topicId || trendId);

          const cacheKey = createCacheKey(resolvedTrendId, isTrendLevelSummary ? resolvedTrendId : resolvedTopicId, currentCategory);
          const fallbackCacheKey = createCacheKey(trendId, isTrendLevelSummary ? trendId : topicId, currentCategory);

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
        } else {
          const message = 'Não foi possível obter o resumo.';
          setSummaryError(message);
          if (isFofocas) {
            updateFofocasSummary(trendKey, (prev) => ({
              ...prev,
              isLoading: false,
              error: message,
            }));
          } else if (isFutebol) {
            updateFutebolSummary(trendKey, (prev) => ({
              ...prev,
              isLoading: false,
              error: message,
            }));
          }

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
        if (isFofocas) {
          updateFofocasSummary(trendKey, (prev) => ({
            ...prev,
            isLoading: false,
            error: message,
          }));
        } else if (isFutebol) {
          updateFutebolSummary(trendKey, (prev) => ({
            ...prev,
            isLoading: false,
            error: message,
          }));
        }

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
        if (isFofocas) {
          updateFofocasSummary(trendKey, (prev) => ({
            ...prev,
            isLoading: false,
          }));
        } else if (isFutebol) {
          updateFutebolSummary(trendKey, (prev) => ({
            ...prev,
            isLoading: false,
          }));
        }
      }
    },
    [createCacheKey, email, normalizeSummaryPayload, currentCategory, getTrendKey, updateFofocasSummary, updateFutebolSummary],
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

      const tableName: DailyTrendsTable =
        category === 'futebol' ? 'daily_futebol' : category === 'fofocas' ? 'daily_fofocas' : 'daily_trends';

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
        if (category === 'fofocas') {
          setFofocasSummaries({});
          fofocasSummaryRefs.current = {};
          setFofocasActiveTrendKey(null);
        }
        if (category === 'futebol') {
          setFutebolSummaries({});
          futebolSummaryRefs.current = {};
          setFutebolActiveTrendKey(null);
        }

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
            fofocas: parsed.batches.fofocas ?? null,
          };
        } else if (parsed.batch_ts !== undefined) {
          persistedBatchRef.current = { brasil: parsed.batch_ts, futebol: null, fofocas: null };
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
    if (currentCategory !== 'fofocas') {
      setFofocasActiveTrendKey(null);
    }
    if (currentCategory !== 'futebol') {
      setFutebolActiveTrendKey(null);
    }
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
            (t.position === expandedTrendId || t.id === expandedTrendId) &&
            (t.id === ctx.trendId || t.title === ctx.trendId || t.position === ctx.trendPosition),
        ));

    const matchesTopic =
      !selectedTopic ||
      (ctx.topicNumber === selectedTopic.number ||
        ctx.topicId === selectedTopic.id ||
        ctx.topicId === selectedTopic.description);

    if (matchesTrend && matchesTopic) {
      const targetTrend =
        trends.find((t) => t.position === ctx.trendPosition) ||
        trends.find((t) => (t.id ?? t.title) === ctx.trendId) ||
        null;
      const trendKey = targetTrend ? getTrendKey(targetTrend) : null;

      if ((ctx.category ?? currentCategory) === 'fofocas') {
        if (trendKey) {
          updateFofocasSummary(trendKey, (prev) => ({
            ...prev,
            topic: selectedTopic ?? prev.topic,
            summary: pendingSummary.summary,
            metadata: pendingSummary.metadata,
            fromCache: pendingSummary.fromCache,
            isLoading: false,
            error: null,
          }));
        }
      } else {
        setSelectedSummary(pendingSummary.summary);
        setSummaryMetadata(pendingSummary.metadata);
        setSummaryFromCache(pendingSummary.fromCache);
      }
      setPendingSummary(null);
      setSummaryBubbleState('ready');
    }
  }, [pendingSummary, expandedTrendId, selectedTopic, trends, currentCategory, getTrendKey, updateFofocasSummary]);

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
    if (currentCategory === 'fofocas') {
      setFofocasActiveTrendKey(null);
    }
    if (currentCategory === 'futebol') {
      setFutebolActiveTrendKey(null);
    }
  };

  const renderTrendList = () => (
    <div className="space-y-4">
      {visibleTrends.map((trend, index) => (
        <div
          key={`${trend.position}-${trend.title}`}
          ref={(el) => {
            if (expandedTrendId === trend.position) {
              selectedTrendRef.current = el;
            }
            trendElementRefs.current[trend.position] = el;
          }}
          className={`scroll-mt-28 animate-card-enter ${index % 2 === 0 ? 'tilt-left' : 'tilt-right'}`}
          style={{ animationDelay: `${index * 50}ms` }}
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
              const isFofocasCategory = currentCategory === 'fofocas';
              const trendKey = getTrendKey(trend);
              const trendEl = trendElementRefs.current[trend.position];
              const { parent, parentOffset, windowOffset, documentOffset, bodyOffset, parentLabel, candidates } =
                resolveScrollContext(trendEl ?? pageContainerRef.current);
              scrollParentRef.current = parent;

              const effectiveOffset = Math.max(parentOffset, windowOffset);
              lastScrollBeforeSummaryRef.current = effectiveOffset;
              lastPageScrollRef.current = windowOffset;

              if (trendEl) {
                const rect = trendEl.getBoundingClientRect();
                if (parent && parent !== window) {
                  const parentRect = (parent as HTMLElement).getBoundingClientRect();
                  lastAnchorYRef.current = Math.max(0, parentOffset + rect.top - parentRect.top - 80);
                } else {
                  lastAnchorYRef.current = Math.max(0, effectiveOffset + rect.top - 80);
                }
              } else {
                lastAnchorYRef.current = lastScrollBeforeSummaryRef.current;
              }

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

              if (isFofocasCategory) {
                setFofocasActiveTrendKey(trendKey);
                setSelectedSummary(null);
                setSummaryMetadata(null);
                setSummaryFromCache(false);

                // For fofocas, use position as it's guaranteed unique (consistent with getTrendKey)
                const trendIdForCache = (trend.position ?? trend.id ?? trend.title ?? '').toString();
                const fofocasCacheKey = createCacheKey(trendIdForCache, trendIdForCache, currentCategory);
                const cachedFofocasSummary = summaryCacheRef.current.get(fofocasCacheKey);

                if (cachedFofocasSummary) {
                  updateFofocasSummary(trendKey, (prev) => ({
                    ...prev,
                    topic: null,
                    summary: cachedFofocasSummary.summary,
                    metadata: cachedFofocasSummary.metadata,
                    fromCache: Boolean(cachedFofocasSummary.fromCache),
                    isLoading: false,
                    error: null,
                  }));
                } else {
                  updateFofocasSummary(trendKey, (prev) => ({
                    ...prev,
                    topic: null,
                    error: null,
                  }));
                  fetchSummaryForTopic(trend, null);
                }
                return;
              }

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
                  ref={(el) => {
                    if (currentCategory !== 'fofocas' && currentCategory !== 'futebol') {
                      summaryContainerRef.current = el;
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  {renderSummaryContent('desktop', trend)}
                </div>
              );
            }}
            hideTopics={currentCategory === 'fofocas' || currentCategory === 'futebol'}
            afterContent={
              currentCategory === 'fofocas' || currentCategory === 'futebol' ? (() => {
                const isFofocasCategory = currentCategory === 'fofocas';
                const summariesState = isFofocasCategory ? fofocasSummaries : futebolSummaries;
                const setActiveTrendKey = isFofocasCategory ? setFofocasActiveTrendKey : setFutebolActiveTrendKey;
                const updateSummary = isFofocasCategory ? updateFofocasSummary : updateFutebolSummary;
                const trendKey = getTrendKey(trend);
                const trendState = summariesState[trendKey];

                return (
                  <div className="mt-3 space-y-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        const trendEl = trendElementRefs.current[trend.position];
                        const { parent, parentOffset, windowOffset } =
                          resolveScrollContext(trendEl ?? pageContainerRef.current);
                        scrollParentRef.current = parent;

                        const effectiveOffset = Math.max(parentOffset, windowOffset);
                        lastScrollBeforeSummaryRef.current = effectiveOffset;
                        lastPageScrollRef.current = windowOffset;

                        if (trendEl) {
                          const rect = trendEl.getBoundingClientRect();
                          if (parent && parent !== window) {
                            const parentRect = (parent as HTMLElement).getBoundingClientRect();
                            lastAnchorYRef.current = Math.max(0, parentOffset + rect.top - parentRect.top - 80);
                          } else {
                            lastAnchorYRef.current = Math.max(0, effectiveOffset + rect.top - 80);
                          }
                        } else {
                          lastAnchorYRef.current = lastScrollBeforeSummaryRef.current;
                        }

                        // Use position as it's guaranteed unique (consistent with getTrendKey)
                        const trendIdForCache = (trend.position ?? trend.id ?? trend.title ?? '').toString();
                        const cacheKey = createCacheKey(trendIdForCache, trendIdForCache, currentCategory);
                        const cachedSummary = summaryCacheRef.current.get(cacheKey);

                        setExpandedTrendId(trend.position ?? null);
                        setSelectedTopic(null);
                        setSelectedSummary(null);
                        setSummaryMetadata(null);
                        setSummaryFromCache(false);
                        setSummaryError(null);
                        setActiveTrendKey(trendKey);

                        if (cachedSummary) {
                          updateSummary(trendKey, (prev) => ({
                            ...prev,
                            topic: null,
                            summary: cachedSummary.summary,
                            metadata: cachedSummary.metadata,
                            fromCache: Boolean(cachedSummary.fromCache),
                            isLoading: false,
                            error: null,
                          }));
                        } else {
                          updateSummary(trendKey, (prev) => ({
                            ...prev,
                            error: null,
                          }));
                          fetchSummaryForTopic(trend, null);
                        }
                      }}
                      disabled={isLoading || isRefreshing || trendState?.isLoading}
                      className="inline-flex w-full items-center justify-center gap-2 px-4 py-3 bg-black border-2 border-black text-white text-sm font-mono font-bold uppercase shadow-[3px_3px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${trendState?.isLoading ? 'animate-spin' : ''}`}
                      />
                      Gerar resumo do assunto
                    </button>
                    <div className="hidden lg:block">
                      {trendState?.summary || trendState?.isLoading || trendState?.error ? (
                        renderSummaryContent('desktop', trend)
                      ) : null}
                    </div>
                  </div>
                );
              })() : null
            }
            disabled={isLoading || isRefreshing}
          />
        </div>
      ))}
    </div>
  );

  const renderSummaryProgress = () => (
    <div className="bg-white border-[3px] border-black p-4 shadow-brutal space-y-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-brutal-yellow border-2 border-black">
        <Loader2 className="w-5 h-5 animate-spin text-black" />
        <span className="text-xs font-mono font-bold text-black uppercase tracking-wide">
          QUENTY-IA em ação (~1–2 min)
        </span>
      </div>
      <ul className="space-y-2">
        {summarySteps.map((step, idx) => {
          const active = idx === summaryStepIndex;
          const done = idx < summaryStepIndex;
          return (
            <li
              key={step}
              className={`flex items-center gap-2 px-3 py-2 border-2 border-black ${
                active ? 'bg-brutal-cyan shadow-[2px_2px_0_0_#000000]' : done ? 'bg-green-100' : 'bg-gray-100'
              }`}
            >
              {done ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : active ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <span className="w-4 h-4 border-2 border-black bg-white" />
              )}
              <span className={`text-xs font-mono font-bold ${done ? 'text-green-700' : 'text-black'}`}>{step}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const scrollToSummary = (trendKey?: string | null) => {
    if ((currentCategory === 'fofocas' || currentCategory === 'futebol') && trendKey) {
      const refs = currentCategory === 'fofocas' ? fofocasSummaryRefs : futebolSummaryRefs;
      const target = refs.current[trendKey];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

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
          const targetTrendKey = getTrendKey(targetTrend);
          setExpandedTrendId(targetTrend.position ?? null);

          const matchTopic =
            targetTrend.topics?.find(
              (topic) =>
                topic.number === lastSummaryContext.topicNumber ||
                topic.id === lastSummaryContext.topicId ||
                topic.description === lastSummaryContext.topicId,
            ) || targetTrend.topics?.[0] || null;

          if (
            (pendingSummary?.context?.category ?? lastSummaryData?.context?.category ?? currentCategory) === 'fofocas'
          ) {
            setFofocasActiveTrendKey(targetTrendKey);
            setSelectedTopic(null);
          } else {
            setSelectedTopic(matchTopic ?? null);
          }
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
            if ((payload.context.category ?? currentCategory) === 'fofocas' && targetTrendKey) {
              updateFofocasSummary(targetTrendKey, (prev) => ({
                ...prev,
                topic: matchTopic ?? prev.topic,
                summary: payload.summary,
                metadata: payload.metadata,
                fromCache: payload.fromCache,
                isLoading: false,
                error: null,
              }));
            } else {
              setSelectedSummary(payload.summary);
              setSummaryMetadata(payload.metadata);
              setSummaryFromCache(payload.fromCache);
            }
            return true;
          };

          if (matchesContext(pendingSummary?.context ?? null) && applySummary(pendingSummary)) {
            setPendingSummary(null);
          } else if (matchesContext(lastSummaryData?.context ?? null) && applySummary(lastSummaryData)) {
            // keep lastSummaryData for future clicks
          }
          setTimeout(() => scrollToSummary(targetTrendKey), 100);
          return;
        }
      }

      scrollToSummary((currentCategory === 'fofocas' || currentCategory === 'futebol') ? lastSummaryContext.trendId?.toString() ?? null : undefined);
    };
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`fixed right-4 bottom-20 z-50 flex items-center gap-2 px-5 py-3 border-[3px] border-black font-mono font-bold uppercase tracking-wide transition-all lg:right-6 lg:bottom-6 hover:-translate-x-0.5 hover:-translate-y-0.5 ${
          isReady
            ? 'bg-accent text-black shadow-[4px_4px_0_0_#000000] hover:shadow-[6px_6px_0_0_#000000]'
            : 'bg-brutal-orange text-white shadow-[4px_4px_0_0_#000000] hover:shadow-[6px_6px_0_0_#000000]'
        }`}
      >
        {isReady ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <Loader2 className="w-5 h-5 animate-spin" />
        )}
        <span className="text-sm">
          {isReady ? 'RESUMO PRONTO' : 'PREPARANDO...'}
        </span>
      </button>
    );
  };

  const renderCaptureBubble = () => {
    if (!isRevealingTrends) return null;

    return (
      <div className="fixed right-4 bottom-36 z-40 flex max-w-xs items-start gap-3 bg-white border-[3px] border-black px-4 py-3 shadow-brutal lg:right-6 lg:bottom-24">
        <Loader2 className="w-5 h-5 animate-spin text-brutal-orange mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-mono font-bold text-xs text-black uppercase">CAPTURANDO EM TEMPO REAL</p>
          <p className="text-[12px] text-gray-700">{captureSteps[captureStepIndex] ?? captureSteps[0]}</p>
          {totalTrends > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 border border-black">
                <div
                  className="h-full bg-brutal-cyan transition-all duration-300"
                  style={{ width: `${(revealedCount / totalTrends) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-black">
                {revealedCount}/{totalTrends}
              </span>
            </div>
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
    const currentTrendKey = currentTrend ? getTrendKey(currentTrend) : null;
    const isTrendLevel = currentCategory === 'fofocas' || currentCategory === 'futebol';
    const trendLevelState =
      isTrendLevel && currentTrendKey
        ? (currentCategory === 'fofocas' ? fofocasSummaries[currentTrendKey] : futebolSummaries[currentTrendKey])
        : undefined;

    // For fofocas/futebol, never fallback to global state to avoid showing stale data from previous trend
    const activeTopic = isTrendLevel ? (trendLevelState?.topic ?? null) : selectedTopic;
    const activeSummary = isTrendLevel ? (trendLevelState?.summary ?? null) : selectedSummary;
    const activeMetadata = isTrendLevel ? (trendLevelState?.metadata ?? null) : summaryMetadata;
    const activeFromCache = isTrendLevel ? (trendLevelState?.fromCache ?? false) : summaryFromCache;
    const activeError = isTrendLevel ? (trendLevelState?.error ?? null) : summaryError;
    const activeIsLoading = isTrendLevel ? (trendLevelState?.isLoading ?? false) : isLoadingSummary;
    const topicEngagement = activeTopic ? extractTopicEngagement(activeTopic) : null;
    const hasCachedSummary = activeFromCache && Boolean(activeSummary);
    const summaryTopicName =
      activeSummary?.['topic-name'] ??
      activeSummary?.topicName ??
      ((activeMetadata?.['topic-name'] as string) || (activeMetadata?.topicName as string) || undefined);
    const summaryTrendName =
      (activeMetadata?.trendName as string) ?? (activeMetadata?.['trend-name'] as string);
    const summaryLikesData = activeSummary?.['likes-data'] ?? activeSummary?.likesData;
    const summaryTopicsSummary =
      (activeMetadata?.topicsSummary as string) ?? (activeMetadata?.['topicsSummary'] as string);
    const summaryContext =
      Array.isArray(activeSummary?.context) && activeSummary?.context
        ? activeSummary.context.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
    const summaryDebate =
      Array.isArray(activeSummary?.debate) && activeSummary?.debate
        ? activeSummary.debate.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];

    return (
      <div className="bg-white border-[3px] border-black shadow-brutal flex flex-col h-full">
        {isMobile && (
          <div
            ref={mobileSummaryTopRef}
            className="sticky top-0 z-10 flex items-center gap-2 border-b-[3px] border-black bg-brutal-yellow px-4 py-3 scroll-mt-24"
          >
            <button
              type="button"
              onClick={() => {
                const { parent, parentOffset, windowOffset, documentOffset, bodyOffset, parentLabel } =
                  resolveScrollContext(selectedTrendRef.current ?? pageContainerRef.current);
                scrollParentRef.current = parent;
                const savedY = Math.max(parentOffset, windowOffset, lastPageScrollRef.current, lastAnchorYRef.current);
                const targetEl = selectedTrendRef.current;

                setSelectedTopic(null);
                setSelectedSummary(null);
                if (currentCategory === 'fofocas') {
                  setFofocasActiveTrendKey(null);
                } else if (currentCategory === 'futebol') {
                  setFutebolActiveTrendKey(null);
                }
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    scrollToPosition(Math.max(0, savedY), parent);
                    if (targetEl) {
                      targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
                    }
                  });
                });
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-black text-sm font-mono font-bold uppercase shadow-[3px_3px_0_0_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              aria-label="Voltar para lista"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Voltar</span>
            </button>
          </div>
        )}
        <div ref={!isMobile ? desktopSummaryRef : undefined} className={`flex-1 overflow-y-auto ${contentPadding}`}>
          {activeTopic ||
          (isTrendLevel && (activeIsLoading || activeSummary || activeError)) ? (
            <div className="space-y-3">
              {isMobile && (
                <>
                  <div className="px-3 py-2 bg-black border-2 border-black text-white font-mono text-xs font-bold uppercase tracking-wide">
                    Assunto #{currentTrend?.position ?? '?'} — {currentTrend?.title ?? 'Assunto'}
                    {activeTopic && !isTrendLevel ? ` — Tópico #${activeTopic.number}` : ''}
                  </div>
                  {activeTopic && !isTrendLevel && (
                    <>
                      <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0_0_#000000]">
                        <p className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-2">Comentário</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{activeTopic.description}</p>
                      </div>
                      <div className="bg-white border-[3px] border-black p-3 shadow-[3px_3px_0_0_#000000]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-brutal-yellow border-2 border-black text-black text-xs font-mono font-bold">
                            👍 {topicEngagement?.likesLabel ?? 'N/A'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-brutal-cyan border-2 border-black text-black text-xs font-mono font-bold">
                            💬 {topicEngagement?.repliesLabel ?? 'N/A'}
                          </span>
                        </div>
                        {activeTopic.posted_at && (
                          <p className="text-[11px] font-mono text-gray-600 mt-2 uppercase">
                            Publicado: {formatDate(activeTopic.posted_at)}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {!isTrendLevel && (
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                  {!hasCachedSummary && (
                    <button
                      type="button"
                      onClick={() => currentTrend && fetchSummaryForTopic(currentTrend, activeTopic)}
                      disabled={activeIsLoading || !currentTrend}
                      className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-3 bg-black border-2 border-black text-white text-sm font-mono font-bold uppercase shadow-[3px_3px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`h-4 w-4 ${activeIsLoading ? 'animate-spin' : ''}`} />
                      Gerar resumo
                    </button>
                  )}
                  {hasCachedSummary && (
                    <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 px-3 py-2 bg-white border-2 border-black text-black text-xs font-mono font-bold shadow-[2px_2px_0_0_#22c55e]">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      RESUMO EM CACHE
                      <button
                        type="button"
                        onClick={() =>
                          currentTrend && fetchSummaryForTopic(currentTrend, activeTopic, { forceRefresh: true })
                        }
                        className="ml-1 px-2 py-0.5 bg-brutal-cyan border border-black text-black text-[10px] font-mono font-bold uppercase hover:bg-brutal-yellow transition-colors"
                      >
                        Reprocessar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeIsLoading && renderSummaryProgress()}
              {activeError && !activeIsLoading && (
                <div className="bg-red-50 border-[3px] border-red-500 p-3 shadow-[3px_3px_0_0_#ef4444]">
                  <p className="text-sm font-mono font-bold text-red-600">{activeError}</p>
                </div>
              )}
              {activeSummary && !activeIsLoading && !activeError && (
                <div
                  ref={(el) => {
                    if (isTrendLevel && currentTrendKey) {
                      const refs = currentCategory === 'fofocas' ? fofocasSummaryRefs : futebolSummaryRefs;
                      if (!el) {
                        const { [currentTrendKey]: _, ...rest } = refs.current;
                        refs.current = rest;
                      } else {
                        refs.current[currentTrendKey] = el;
                      }
                    } else {
                      summaryContainerRef.current = el;
                    }
                  }}
                  className="bg-white border-[3px] border-black p-4 shadow-brutal space-y-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {summaryTopicName && (
                        <span className="font-mono font-bold text-black text-sm">{summaryTopicName}</span>
                      )}
                      {summaryTrendName && (
                        <span className="px-2 py-0.5 bg-gray-200 border border-black text-[11px] font-mono text-black">
                          {summaryTrendName}
                        </span>
                      )}
                      {summaryLikesData && (
                        <span className="px-2 py-0.5 bg-brutal-orange border border-black text-[11px] font-mono font-bold text-white">
                          {summaryLikesData}
                        </span>
                      )}
                    </div>
                  </div>

                  {summaryContext.length > 0 && (
                    <div className="border-l-4 border-black pl-3">
                      <p className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-2">Contexto</p>
                      <ul className="space-y-2">
                        {summaryContext.map((item, index) => (
                          <li key={`${index}-${item.slice(0, 10)}`} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                            <span className="w-2 h-2 bg-brutal-cyan border border-black mt-1.5 flex-shrink-0"></span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-brutal-yellow/20 border-2 border-black p-3">
                    <p className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-2">Resumo</p>
                    {activeSummary.thesis && (
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {activeSummary.thesis}
                      </p>
                    )}
                    {!activeSummary.thesis && activeSummary.personalization && (
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {activeSummary.personalization}
                      </p>
                    )}
                  </div>

                  {activeSummary.personalization && activeSummary.thesis && (
                    <div className="bg-brutal-cyan/20 border-2 border-black p-3">
                      <p className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-2">Personalização</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                        {activeSummary.personalization}
                      </p>
                    </div>
                  )}

                  {summaryDebate.length > 0 && (
                    <div className="border-l-4 border-brutal-orange pl-3">
                      <p className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-2">Pontos de debate</p>
                      <ul className="space-y-2">
                        {summaryDebate.map((item, index) => (
                          <li key={`${index}-${item.slice(0, 10)}`} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                            <span className="w-2 h-2 bg-brutal-orange border border-black mt-1.5 flex-shrink-0"></span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(activeSummary['why-it-matters'] || activeSummary.whyItMatters) && (
                    <div className="bg-gray-100 border-2 border-black p-3">
                      <p className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-2">Por que importa</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                        {activeSummary['why-it-matters'] || activeSummary.whyItMatters}
                      </p>
                    </div>
                  )}

                  {Array.isArray(activeSummary.sources) && activeSummary.sources.length > 0 && (
                    <div className="border-t-2 border-black pt-3">
                      <p className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-2">Fontes</p>
                      <ul className="space-y-2">
                        {activeSummary.sources.map((source, index) => (
                          <li key={`${source.url ?? index}`} className="text-xs">
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-brutal-orange font-mono">
                              {source.title || source.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaryTopicsSummary && (
                    <div>
                      <p className="text-xs font-semibold text-text-primary mb-1">Resumo dos tópicos</p>
                      <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed">{summaryTopicsSummary}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-text-muted">
              <p>
                {isTrendLevel
                  ? 'Peça um resumo do assunto para ver aqui.'
                  : 'Selecione um tópico para ver detalhes.'}
              </p>
            </div>
          )}
        </div>
        {isMobile && (
          <div className={`border-t border-border-primary bg-dark-tertiary ${footerPadding} text-xs text-text-muted`}>
            {formatTimestamp ? `Atualizado em ${formatTimestamp}` : 'Aguardando dados recentes...'}
          </div>
        )}
      </div>
    );
  };

  const activeFofocasState = fofocasActiveTrendKey ? fofocasSummaries[fofocasActiveTrendKey] : null;
  const activeFutebolState = futebolActiveTrendKey ? futebolSummaries[futebolActiveTrendKey] : null;
  const showMobileSummary =
    currentCategory === 'fofocas'
      ? Boolean(
          fofocasActiveTrendKey &&
            (activeFofocasState?.isLoading ||
              activeFofocasState?.summary ||
              activeFofocasState?.error ||
              !activeFofocasState),
        )
      : currentCategory === 'futebol'
        ? Boolean(
            futebolActiveTrendKey &&
              (activeFutebolState?.isLoading ||
                activeFutebolState?.summary ||
                activeFutebolState?.error ||
                !activeFutebolState),
          )
        : Boolean(selectedTopic || selectedSummary);
  const prevShowMobileSummaryRef = useRef<boolean>(false);

  useEffect(() => {
    const { parent, parentOffset, windowOffset, documentOffset, bodyOffset, parentLabel } = resolveScrollContext(
      selectedTrendRef.current ?? pageContainerRef.current,
    );
    scrollParentRef.current = parent;

    if (showMobileSummary) {
      prevShowMobileSummaryRef.current = true;
      if (mobileListContainerRef.current) {
        mobileListScrollPosition.current = mobileListContainerRef.current.scrollTop;
      }
      lastListScrollYRef.current = Math.max(parentOffset, windowOffset);
      lastPageScrollRef.current = windowOffset;

      if (mobileSummaryWrapperRef.current) {
        mobileSummaryWrapperRef.current.scrollTo({ top: 0, behavior: 'auto' });
      }
      // Bring summary to top (CTA Voltar)
      if (mobileSummaryTopRef.current) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            mobileSummaryTopRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
          });
        });
      }
    } else {
      const targetY = Math.max(0, lastAnchorYRef.current || lastScrollBeforeSummaryRef.current || lastPageScrollRef.current);
      const restore = () => {
        scrollToPosition(targetY, parent);
        const targetEl = selectedTrendRef.current;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      };
      // Only restore when we are actually closing a summary, not on plain list expand/collapse.
      if (prevShowMobileSummaryRef.current) {
        requestAnimationFrame(() => {
          requestAnimationFrame(restore);
        });
      }
      prevShowMobileSummaryRef.current = false;
    }
  }, [showMobileSummary, expandedTrendId, scrollToPosition, resolveScrollContext]);

  const handleMobileListScroll = useCallback(() => {
    if (mobileListContainerRef.current) {
      mobileListScrollPosition.current = mobileListContainerRef.current.scrollTop;
    }
  }, []);

  return (
    <div className="min-h-screen bg-brutal-yellow" ref={pageContainerRef}>
      {/* Hero Section - Neo-Brutalist */}
      <div className="w-full bg-black border-b-[4px] border-black">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-brutal-orange rounded-full animate-pulse"></div>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-brutal-cyan">
                AO VIVO
              </span>
            </div>
            <h1 className="font-mono text-3xl md:text-5xl font-extrabold text-white uppercase tracking-tight leading-none">
              ASSUNTOS QUENTES
            </h1>
            <p className="text-white/80 text-sm md:text-base max-w-md">
              Quenty AI monitora as redes 24/7 e entrega os 15 assuntos mais quentes do momento.
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-brutal-yellow border-2 border-black text-black text-xs font-mono font-bold shadow-[3px_3px_0_0_#FFFFFF]">
                15 ASSUNTOS
              </div>
              {formatTimestamp && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-black text-xs font-mono font-bold shadow-[3px_3px_0_0_#FFDD00]">
                  ATUALIZADO: {formatTimestamp}
                </div>
              )}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-brutal-cyan border-2 border-black text-black text-xs font-mono font-bold shadow-[3px_3px_0_0_#FFFFFF]">
                FONTES VERIFICADAS
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {showTapPushCta && (
          <div className="bg-white border-[3px] border-black px-4 py-4 shadow-brutal">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center bg-brutal-orange border-2 border-black text-white shadow-[3px_3px_0_0_#000000]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-mono font-bold text-black uppercase">
                  ATIVE AS NOTIFICAÇÕES
                </p>
                <p className="text-xs text-gray-700">
                  Sem notificações ativas não conseguimos entregar as 15 notícias do dia para você. Habilite o alerta do navegador para ser avisado assim que o resumo ficar pronto.
                </p>
                {tapPushError && <p className="text-xs text-red-600 font-mono font-bold">{tapPushError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleTapEnablePush}
                    disabled={tapPushLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-black border-2 border-black text-white text-xs font-mono font-bold uppercase shadow-[3px_3px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {tapPushLoading ? 'ATIVANDO...' : 'ATIVAR NOTIFICAÇÕES'}
                  </button>
                  <button
                    type="button"
                    onClick={dismissTapPush}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-black text-xs font-mono font-bold uppercase shadow-[3px_3px_0_0_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000000] transition-all"
                  >
                    AGORA NÃO
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-white border-[3px] border-red-500 flex gap-3 animate-fadeIn shadow-[4px_4px_0_0_#ef4444]">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-mono font-bold text-red-600 uppercase">ERRO</p>
              <p className="text-sm text-gray-700 mt-1">{error}</p>
              <button
                onClick={() => fetchLatestTrends(currentCategory, { isRefresh: true })}
                className="mt-2 text-sm font-mono font-bold text-red-600 uppercase underline underline-offset-2 hover:text-red-800"
              >
                TENTAR NOVAMENTE
              </button>
            </div>
          </div>
        )}

        {/* Category Tabs - Brutalist Style */}
        <div className="flex flex-wrap gap-3">
          {TABS.map(({ key: cat, label }) => {
            const isActive = currentCategory === cat;
            const tabIcons: Record<TapCategory, string> = {
              brasil: '🇧🇷',
              futebol: '⚽',
              fofocas: '💬',
            };
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  if (cat !== currentCategory) {
                    setCurrentCategory(cat);
                  }
                }}
                className={`
                  inline-flex items-center gap-2 px-5 py-3
                  border-[3px] border-black font-mono font-bold uppercase tracking-wide
                  transition-all duration-150
                  ${isActive
                    ? 'bg-black text-white shadow-[4px_4px_0_0_#FFDD00] -translate-x-0.5 -translate-y-0.5'
                    : 'bg-white text-black shadow-[4px_4px_0_0_#000000] hover:bg-gray-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#000000]'
                  }
                `}
              >
                <span className="text-lg">{tabIcons[cat]}</span>
                {label}
              </button>
            );
          })}
        </div>

        {isLoading && revealedCount === 0 && totalTrends === 0 ? (
          <TrendSkeleton />
        ) : !isLoading && revealedCount === 0 && !isRevealingTrends && totalTrends === 0 ? (
          <div className="bg-white border-[3px] border-black px-6 py-12 text-center shadow-brutal">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center bg-brutal-yellow border-2 border-black shadow-[3px_3px_0_0_#000000]">
              <RefreshCw className="h-8 w-8 text-black" />
            </div>
            <h2 className="text-xl font-mono font-bold text-black uppercase">NENHUMA TENDÊNCIA</h2>
            <p className="mt-2 text-sm text-gray-700">Tente atualizar para carregar as últimas tendências.</p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => fetchLatestTrends(currentCategory, { isRefresh: true })}
                disabled={isLoading || isRefreshing}
                className="inline-flex items-center gap-2 px-5 py-3 bg-black border-[3px] border-black text-white font-mono font-bold uppercase tracking-wide shadow-brutal-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                BUSCAR TENDÊNCIAS
              </button>
            </div>
          </div>
        ) : (
          <>
            {trendsSummary && trends.length > 0 && (
              <div className="bg-white border-[3px] border-black p-4 shadow-brutal">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-mono font-bold text-black uppercase tracking-widest">PANORAMA DO DIA</h3>
                  <div className="flex-1 h-[2px] bg-black"></div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{trendsSummary}</p>
              </div>
            )}

            <TapInstallAndPushCTA />

            <div className="flex items-center gap-3 mt-6 mb-4">
              <div className="w-2 h-8 bg-black"></div>
              <h2 className="text-xl font-mono font-bold text-black uppercase tracking-tight">
                TOP 15 AGORA
              </h2>
            </div>

              <div className="lg:hidden relative overflow-hidden min-h-[520px]">
                <div
                  className={`w-full transition-transform duration-300 ease-in-out ${
                    showMobileSummary ? '-translate-x-full' : 'translate-x-0'
                  }`}
                >
                  <div
                    ref={mobileListContainerRef}
                    onScroll={handleMobileListScroll}
                    className="space-y-4 pb-8"
                  >
                    {renderTrendList()}
                  </div>
                </div>
                {showMobileSummary && (
                <div
                  ref={mobileSummaryWrapperRef}
                  className="absolute inset-0 w-full transition-transform duration-300 ease-in-out translate-x-0 overflow-y-auto bg-brutal-yellow"
                >
                  {renderSummaryContent(
                    'mobile',
                    currentCategory === 'fofocas' && fofocasActiveTrendKey
                      ? trends.find((t) => getTrendKey(t) === fofocasActiveTrendKey) ?? null
                      : currentCategory === 'futebol' && futebolActiveTrendKey
                        ? trends.find((t) => getTrendKey(t) === futebolActiveTrendKey) ?? null
                        : null
                  )}
                </div>
              )}
            </div>

            <div className="hidden lg:block">{renderTrendList()}</div>

            {!isRevealingTrends && totalTrends > 0 && revealedCount === totalTrends && (
              <div className="mt-8">
                <ProfileSurveyBanner />
              </div>
            )}
          </>
        )}
      </div>
      {renderCaptureBubble()}
      {renderSummaryBubble()}
      {!onboardingStatus.loading && !onboardingStatus.complete && (
        <div className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-white border-[4px] border-black shadow-[8px_8px_0_0_#FFDD00] p-6 space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-brutal-yellow border-2 border-black flex items-center justify-center shadow-[4px_4px_0_0_#000000]">
                <AlertCircle className="w-8 h-8 text-black" />
              </div>
            </div>
            <h2 className="text-xl font-mono font-bold text-black uppercase">FINALIZE SUA PERSONALIZAÇÃO</h2>
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
              className="mt-2 inline-flex items-center justify-center px-6 py-3 bg-black border-[3px] border-black text-white font-mono font-bold uppercase tracking-wide shadow-brutal-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              IR PARA PERSONALIZAÇÃO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


