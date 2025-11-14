import { useState, useEffect, useRef } from 'react';
import { RefreshCw, AlertCircle, Share2, WifiOff, PlayCircle, StopCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TrendCard } from '../components/tap/TrendCard';
import { FloatingChat } from '../components/tap/FloatingChat';
import { LoadingProgress, TrendSkeleton } from '../components/tap/LoadingProgress';
import { tapNavigationService } from '../lib/tapNavigationService';
import { websocketService, type WebSocketMessage } from '../lib/websocket';
import { TrendData, TopicData, SummaryData } from '../types/tapNavigation';
import { ChatMessage, generateMessageId } from '../lib/chatService';
import { TopicSummary } from '../components/TopicSummary';
import { safeJsonParse } from '../lib/safeJsonParse';

export function TapNavigationPage() {
  const { user } = useAuth();
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
  const [topicsMap, setTopicsMap] = useState<Record<string, TopicData[]>>({});
  const [topicsSummaryMap, setTopicsSummaryMap] = useState<Record<string, string | null>>({});
  const [topicsErrorMap, setTopicsErrorMap] = useState<Record<string, string | null>>({});
  const [selectedTopic, setSelectedTopic] = useState<TopicData | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<SummaryData | null>(null);
  const [trendsSummary, setTrendsSummary] = useState<string | null>(null);
  const [summaryFromCache, setSummaryFromCache] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [loadingTopicsTrendId, setLoadingTopicsTrendId] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasRequestedTrends, setHasRequestedTrends] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatProcessing, setIsChatProcessing] = useState(false);

  const [currentContext, setCurrentContext] = useState<{ trendName?: string; topicName?: string }>({});
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'
  >('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [chatConnectionState, setChatConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(
    'disconnected',
  );

  const trendRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mobileSummaryContentRef = useRef<HTMLDivElement | null>(null);
  const desktopSummaryContentRef = useRef<HTMLDivElement | null>(null);
  const activeTrendsRequestIdRef = useRef<string | null>(null);
  const cancelledTrendRequestsRef = useRef<Set<string>>(new Set());

  const resetSelectionState = () => {
    setExpandedTrendId(null);
    setSelectedTopic(null);
    setSelectedSummary(null);
    setSummaryFromCache(false);
    setSummaryError(null);
    setCurrentContext({});
  };

  const scrollToTrend = (trendId: string) => {
    const element = trendRefs.current[trendId];
    if (element) {
      const offset = 80;
      const rect = element.getBoundingClientRect();
      const absoluteY = rect.top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(absoluteY, 0), behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollSummaryToTop = () => {
    const isDesktop = window.innerWidth >= 1024;
    const target = isDesktop ? desktopSummaryContentRef.current : mobileSummaryContentRef.current;

    if (target) {
      target.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!user) {
      setConnectionStatus('idle');
      setConnectionError(null);
      setChatConnectionState('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    setConnectionError(null);
    setChatConnectionState('connecting');

    const handleConnected = () => {
      setConnectionStatus('connected');
      setConnectionError(null);
      setChatConnectionState(websocketService.getConnectionState());
    };

    const handleError = (message: WebSocketMessage) => {
      const state = websocketService.getConnectionState();
      setChatConnectionState(state);

      if (state === 'connecting') {
        setConnectionStatus('connecting');
        setConnectionError(null);
        return;
      }

      if (state === 'connected') {
        setConnectionStatus('connected');
        setConnectionError(null);
        return;
      }

      const isSevereError = Boolean(message.error && message.error !== 'Connection closed');
      const nextStatus = isSevereError ? 'error' : 'disconnected';

      setConnectionStatus(nextStatus);
      setConnectionError(
        nextStatus === 'error'
          ? message.error || 'Conexão perdida. Tente reconectar.'
          : 'Conexão com o assistente perdida. Tentando reconectar...'
      );
    };

    websocketService.on('connected', handleConnected);
    websocketService.on('error', handleError);

    const attemptConnection = () =>
      websocketService
        .connect()
        .then(() => {
          setConnectionStatus('connected');
          setConnectionError(null);
          setChatConnectionState(websocketService.getConnectionState());
        })
        .catch((error) => {
          if (error instanceof Error && error.message === 'WebSocket connection intentionally closed') {
            return;
          }
          console.error('Failed to connect WebSocket:', error);
          setConnectionStatus('error');
          setConnectionError(error instanceof Error ? error.message : 'Não foi possível conectar ao WebSocket.');
          setChatConnectionState(websocketService.getConnectionState());
        });

    attemptConnection();

    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('error', handleError);
      websocketService.disconnect();
      setChatConnectionState('disconnected');
    };
  }, [user]);

  useEffect(() => {
    const handleChatEvents = (message: WebSocketMessage) => {
      if (message.type === 'typing_start') {
        setIsChatProcessing(true);
        return;
      }

      if (message.type === 'typing_stop') {
        setIsChatProcessing(false);
        return;
      }

      if (message.type === 'error') {
        setIsChatProcessing(false);

        if (message.error) {
          setChatMessages((prev) => {
            if (prev.length === 0) return prev;

            const updated = [...prev];
            for (let index = updated.length - 1; index >= 0; index -= 1) {
              const current = updated[index];
              if (current.role === 'user' && current.status === 'sending') {
                updated[index] = { ...current, status: 'error' };
                break;
              }
            }

            return updated;
          });
        }

        return;
      }

      if (message.type !== 'message' || message.role !== 'assistant') {
        return;
      }

      setIsChatProcessing(false);

      type ParsedContent = {
        type?: string;
        buttons?: unknown;
        metadata?: unknown;
        items?: unknown;
      };

      const parsedContent = safeJsonParse<ParsedContent>(message.content);
      const parsedType = typeof parsedContent?.type === 'string' ? parsedContent.type : undefined;
      const allowedTypes: ChatMessage['contentType'][] = ['text', 'trends', 'topics', 'summary'];
      const resolvedContentType =
        (message.contentType && (allowedTypes as string[]).includes(message.contentType)
          ? (message.contentType as ChatMessage['contentType'])
          : undefined) ||
        (parsedType && (allowedTypes as string[]).includes(parsedType)
          ? (parsedType as ChatMessage['contentType'])
          : 'text');

      const primaryButtons = parsedContent?.buttons;
      const fallbackButtons = message.buttons;

      const normalizeButtons = (buttons: unknown): ChatMessage['buttons'] => {
        if (!Array.isArray(buttons)) {
          return undefined;
        }

        const normalized = buttons
          .map((button) => {
            if (!button) return null;

            if (typeof button === 'string') {
              return { label: button, value: button };
            }

            if (typeof button === 'object') {
              const candidate = button as Record<string, unknown>;
              const label =
                (candidate.label ?? candidate.title ?? candidate.text ?? candidate.name) as string | undefined;
              const value = (candidate.value ?? candidate.payload ?? candidate.action) as string | undefined;

              if (typeof label === 'string' && typeof value === 'string') {
                return { label, value };
              }
            }

            return null;
          })
          .filter((button): button is NonNullable<ChatMessage['buttons']>[number] => Boolean(button));

        return normalized.length > 0 ? normalized : undefined;
      };

      const parsedButtons = normalizeButtons(primaryButtons);
      const fallbackNormalizedButtons = normalizeButtons(fallbackButtons);
      const mergedButtons = parsedButtons ?? fallbackNormalizedButtons;

      const aiMessage: ChatMessage = {
        id: message.correlationId || generateMessageId(),
        role: 'assistant',
        content: message.content || '',
        timestamp: new Date(),
        contentType: resolvedContentType,
        structuredData:
          parsedContent && Object.prototype.hasOwnProperty.call(parsedContent, 'items')
            ? parsedContent.items
            : message.structuredData || null,
        metadata:
          message.metadata ||
          (parsedContent?.metadata && typeof parsedContent.metadata === 'object'
            ? parsedContent.metadata
            : undefined),
        buttons: mergedButtons,
      };

      setChatMessages((prev) => [...prev, aiMessage]);
    };

    websocketService.on('message', handleChatEvents);
    websocketService.on('typing_start', handleChatEvents);
    websocketService.on('typing_stop', handleChatEvents);
    websocketService.on('error', handleChatEvents);

    return () => {
      websocketService.off('message', handleChatEvents);
      websocketService.off('typing_start', handleChatEvents);
      websocketService.off('typing_stop', handleChatEvents);
      websocketService.off('error', handleChatEvents);
    };
  }, []);

  const createRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const cancelActiveTrendsRequest = (options?: { silent?: boolean }) => {
    const activeRequest = activeTrendsRequestIdRef.current;
    if (!activeRequest) {
      return;
    }

    cancelledTrendRequestsRef.current.add(activeRequest);
    tapNavigationService.cancelTrendsRequest();
    activeTrendsRequestIdRef.current = null;

    if (!options?.silent) {
      setIsLoadingTrends(false);
    }
  };

  const loadTrends = async (forceRefresh = false) => {
    setHasRequestedTrends(true);

    if (forceRefresh) {
      resetSelectionState();
      setTopicsMap({});
      setTopicsSummaryMap({});
      setTopicsErrorMap({});
      setTrendsSummary(null);
      trendRefs.current = {};
    }

    cancelActiveTrendsRequest({ silent: true });

    const requestId = createRequestId();
    activeTrendsRequestIdRef.current = requestId;

    try {
      setIsLoadingTrends(true);
      setError(null);

      const result = await tapNavigationService.fetchTrends({ forceRefresh });

      const wasCancelled = cancelledTrendRequestsRef.current.has(requestId);
      const isLatestRequest = activeTrendsRequestIdRef.current === requestId;

      if (wasCancelled || !isLatestRequest) {
        return;
      }

      if (result.success && result.data) {
        const trendsList = result.data as TrendData[];
        setTrends(trendsList);
        setTrendsSummary(result.trendsSummary ?? null);

        const initialTopicsMap: Record<string, TopicData[]> = {};
        const initialTopicsSummaryMap: Record<string, string | null> = {};

        trendsList.forEach((trend) => {
          if (Array.isArray(trend.topics) && trend.topics.length > 0) {
            initialTopicsMap[trend.id] = trend.topics;
            initialTopicsSummaryMap[trend.id] = null;
          }
        });

        setTopicsMap(initialTopicsMap);
        setTopicsSummaryMap(initialTopicsSummaryMap);
        setTopicsErrorMap({});

        if (result.error) {
          setError(result.error);
        } else {
          setError(null);
        }
      } else {
        setError(result.error || 'Failed to load trends');
      }
    } catch (err) {
      const wasCancelled = cancelledTrendRequestsRef.current.has(requestId);
      const isLatestRequest = activeTrendsRequestIdRef.current === requestId;

      if (wasCancelled || !isLatestRequest) {
        return;
      }

      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      const isLatestRequest = activeTrendsRequestIdRef.current === requestId;
      const wasCancelled = cancelledTrendRequestsRef.current.delete(requestId);

      if (isLatestRequest) {
        activeTrendsRequestIdRef.current = null;
        setIsLoadingTrends(false);
      } else if (wasCancelled && !activeTrendsRequestIdRef.current) {
        setIsLoadingTrends(false);
      }
    }
  };

  const loadTopicsForTrend = async (trend: TrendData, options?: { forceRefresh?: boolean }) => {
    if (isLoadingTopics && loadingTopicsTrendId === trend.id) {
      return;
    }

    if (!options?.forceRefresh && topicsMap[trend.id] && !topicsErrorMap[trend.id]) {
      return;
    }

    setTopicsErrorMap((prev) => ({
      ...prev,
      [trend.id]: null,
    }));

    try {
      setIsLoadingTopics(true);
      setLoadingTopicsTrendId(trend.id);
      const result = await tapNavigationService.fetchTopics(trend.number, options);

      if (result.success && Array.isArray(result.data)) {
        setTopicsMap((prev) => ({
          ...prev,
          [trend.id]: result.data as TopicData[],
        }));
        if (result.topicsSummary !== undefined) {
          setTopicsSummaryMap((prev) => ({
            ...prev,
            [trend.id]: result.topicsSummary,
          }));
        }
        setTopicsErrorMap((prev) => ({
          ...prev,
          [trend.id]: result.error ?? null,
        }));
      } else {
        setTopicsErrorMap((prev) => ({
          ...prev,
          [trend.id]: result.error || 'Não foi possível carregar os tópicos.',
        }));
      }
    } catch (err) {
      console.error('Error loading topics:', err);
      setTopicsErrorMap((prev) => ({
        ...prev,
        [trend.id]: 'Não foi possível carregar os tópicos. Tente novamente.',
      }));
    } finally {
      setIsLoadingTopics(false);
      setLoadingTopicsTrendId(null);
    }
  };

  const handleStartTrends = () => {
    loadTrends();
  };

  const handleCancelTrends = () => {
    cancelActiveTrendsRequest();
    setError(null);
  };

  const handleTrendExpand = async (trend: TrendData) => {
    if (expandedTrendId === trend.id) {
      resetSelectionState();
      return;
    }

    setExpandedTrendId(trend.id);
    setSelectedTopic(null);
    setSelectedSummary(null);
    setSummaryFromCache(false);
    setSummaryError(null);
    setCurrentContext({ trendName: trend.name });

    requestAnimationFrame(() => scrollToTrend(trend.id));

    loadTopicsForTrend(trend);
  };

  const handleTrendCollapse = () => {
    resetSelectionState();
  };

  const handleTopicsRetry = (trend: TrendData) => {
    loadTopicsForTrend(trend, { forceRefresh: true });
  };

  const handleTopicSelect = async (topic: TopicData) => {
    if (!user?.id) return;

    setSelectedTopic(topic);
    setSelectedSummary(null);
    setSummaryFromCache(false);
    setSummaryError(null);

    const trend = trends.find((t) => t.id === expandedTrendId);
    const topicLabel = topic.description?.trim() || `Tópico #${topic.number}`;
    setCurrentContext({
      trendName: trend?.name || '',
      topicName: topicLabel,
    });

    requestAnimationFrame(scrollSummaryToTop);

    try {
      setIsLoadingSummary(true);
      const result = await tapNavigationService.fetchSummary(topic.number, user.id);

      if (result.success && result.data) {
        const summary = result.data as SummaryData;
        setSelectedSummary(summary);
        setSummaryFromCache(result.fromCache || false);
        setSummaryError(result.error ?? null);
        if (result.metadata) {
          const { trendName, topicName } = result.metadata as {
            trendName?: string | null;
            topicName?: string | null;
          };
          setCurrentContext((prev) => ({
            trendName:
              typeof trendName === 'string' && trendName.trim().length > 0 ? trendName : prev.trendName ?? '',
            topicName:
              typeof topicName === 'string' && topicName.trim().length > 0
                ? topicName
                : summary.topicName || prev.topicName || '',
          }));
        } else {
          setCurrentContext((prev) => ({
            trendName: prev.trendName || '',
            topicName: summary.topicName || prev.topicName || '',
          }));
        }
      } else {
        setSummaryError(result.error || 'Não foi possível carregar o resumo.');
      }
    } catch (err) {
      console.error('Error loading summary:', err);
      setSummaryError('Não foi possível carregar o resumo. Tente novamente.');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleSummaryClose = () => {
    setSelectedTopic(null);
    setSelectedSummary(null);
    setSummaryFromCache(false);
    setSummaryError(null);
    const trend = trends.find((t) => t.id === expandedTrendId);
    setCurrentContext(trend ? { trendName: trend.name } : {});
  };

  const handleSummaryRefresh = async () => {
    if (!selectedTopic || !user?.id) return;

    try {
      setIsRefreshing(true);
      setSummaryError(null);
      const result = await tapNavigationService.fetchSummary(selectedTopic.number, user.id, { forceRefresh: true });

      if (result.success && result.data) {
        const summary = result.data as SummaryData;
        setSelectedSummary(summary);
        setSummaryFromCache(false);
        setSummaryError(result.error ?? null);
        if (result.metadata) {
          const { trendName, topicName } = result.metadata as {
            trendName?: string | null;
            topicName?: string | null;
          };
          setCurrentContext((prev) => ({
            trendName:
              typeof trendName === 'string' && trendName.trim().length > 0 ? trendName : prev.trendName || '',
            topicName:
              typeof topicName === 'string' && topicName.trim().length > 0
                ? topicName
                : summary.topicName || prev.topicName || '',
          }));
        } else {
          setCurrentContext((prev) => ({
            trendName: prev.trendName || '',
            topicName: summary.topicName || prev.topicName || '',
          }));
        }
      } else {
        setSummaryError(result.error || 'Não foi possível atualizar o resumo.');
      }
    } catch (err) {
      console.error('Error refreshing summary:', err);
      setSummaryError('Não foi possível atualizar o resumo. Tente novamente.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReconnect = () => {
    if (!user) return;

    setConnectionStatus('connecting');
    setConnectionError(null);
    setChatConnectionState('connecting');

    websocketService
      .connect()
      .then(() => {
        setConnectionStatus('connected');
        setConnectionError(null);
        setChatConnectionState(websocketService.getConnectionState());
      })
      .catch((error) => {
        if (error instanceof Error && error.message === 'WebSocket connection intentionally closed') {
          return;
        }
        console.error('Failed to reconnect WebSocket:', error);
        setConnectionStatus('error');
        setConnectionError(error instanceof Error ? error.message : 'Não foi possível reconectar ao WebSocket.');
        setChatConnectionState(websocketService.getConnectionState());
      });
  };

  const renderConnectionBanner = () => {
    if (connectionStatus === 'idle' || connectionStatus === 'connected') {
      return null;
    }

    if (connectionStatus === 'connecting') {
      return (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-sm text-blue-900">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <div>
              <p className="font-semibold">Conectando ao assistente</p>
              <p className="text-xs text-blue-700">Estabelecendo conexão em tempo real...</p>
            </div>
          </div>
        </div>
      );
    }

    const isError = connectionStatus === 'error';
    const message = isError
      ? connectionError || 'Não foi possível se comunicar com o assistente em tempo real.'
      : connectionError || 'Conexão com o assistente perdida. Tentando reconectar automaticamente...';
    const description = isError
      ? 'Verifique sua conexão ou tente reconectar manualmente.'
      : 'Estamos tentando reconectar. Isso pode levar alguns instantes.';

    return (
      <div className="max-w-5xl mx-auto px-4 mt-4">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <WifiOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">{isError ? 'Conexão com o assistente indisponível' : 'Conexão com o assistente perdida'}</p>
              <p className="text-xs text-amber-700">{message}</p>
              <p className="text-xs text-amber-600 mt-1">{description}</p>
            </div>
          </div>
          {isError && (
            <button
              onClick={handleReconnect}
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold text-amber-900 bg-white border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              Tentar reconectar
            </button>
          )}
        </div>
      </div>
    );
  };

  const handleShare = async () => {
    if (!selectedSummary) return;

    if (navigator.share) {
      try {
        const shareText = [selectedSummary.thesis, selectedSummary.personalization, selectedSummary.likesData]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .join('\n\n');

        await navigator.share({
          title: selectedSummary.topicName,
          text: shareText,
          url: window.location.href,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
          fallbackShare();
        }
      }
    } else {
      fallbackShare();
    }
  };

  const fallbackShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
    }).catch((err) => {
      console.error('Failed to copy:', err);
    });
  };

  const handleChatMessage = async (content: string) => {
    if (!user?.id || isChatProcessing) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'sending',
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsChatProcessing(true);

    try {
      await websocketService.sendMessage(content);

      setChatMessages((prev) =>
        prev.map((msg) => (msg.id === userMessage.id ? { ...msg, status: 'sent' as const } : msg))
      );
    } catch (err) {
      console.error('Error sending message:', err);
      setChatMessages((prev) =>
        prev.map((msg) => (msg.id === userMessage.id ? { ...msg, status: 'error' as const } : msg))
      );
      setIsChatProcessing(false);
    }
  };

  const renderTrendList = () =>
    trends.map((trend) => (
      <div
        key={trend.id}
        ref={(element) => {
          trendRefs.current[trend.id] = element;
        }}
      >
        <TrendCard
          trend={trend}
          isExpanded={expandedTrendId === trend.id}
          topics={topicsMap[trend.id] || null}
          topicsSummary={topicsSummaryMap[trend.id] ?? null}
          isLoadingTopics={isLoadingTopics && expandedTrendId === trend.id}
          topicsError={topicsErrorMap[trend.id] || null}
          onExpand={() => handleTrendExpand(trend)}
          onCollapse={handleTrendCollapse}
          onTopicSelect={handleTopicSelect}
          onRetryTopics={() => handleTopicsRetry(trend)}
          disabled={Boolean(
            isLoadingTopics &&
              loadingTopicsTrendId !== null &&
              loadingTopicsTrendId !== trend.id
          )}
        />
      </div>
    ));

  const renderSummaryContent = (variant: 'mobile' | 'desktop') => {
    const baseClasses =
      variant === 'desktop'
        ? 'h-full flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm'
        : 'h-full flex flex-col bg-white rounded-2xl shadow-lg';
    const contentPadding = variant === 'desktop' ? 'px-6 pt-6 pb-4' : 'px-4 pt-4 pb-4';
    const footerPadding = variant === 'desktop' ? 'px-6 py-4' : 'px-4 py-3';

    const scrollableRef = variant === 'desktop' ? desktopSummaryContentRef : mobileSummaryContentRef;

    if (!selectedTopic) {
      return (
        <div className={`${baseClasses} items-center justify-center text-center`}>
          <div className="px-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecione um tópico</h3>
            <p className="text-sm text-gray-600">
              Explore os assuntos e toque em um tópico para ver o resumo detalhado.
            </p>
          </div>
        </div>
      );
    }

    const hasSummary = Boolean(selectedSummary);
    const summaryFallbackMessage = summaryError || 'Não foi possível carregar o resumo. Tente novamente.';
    const footerLabel = hasSummary
      ? selectedSummary!.likesData || 'Resumo atualizado automaticamente'
      : summaryError
      ? 'Erro ao carregar resumo'
      : 'Preparando resumo...';

    return (
      <div className={baseClasses}>
        <div ref={scrollableRef} className={`flex-1 overflow-y-auto ${contentPadding}`}>
          {isLoadingSummary ? (
            <LoadingProgress message="Carregando resumo..." />
          ) : hasSummary ? (
            <>
              {summaryFromCache && !summaryError && (
                <div className="mb-4 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700">
                  Exibindo uma versão em cache. Toque em atualizar para gerar uma nova visão.
                </div>
              )}
              {summaryError && (
                <div className="mb-4 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700">
                  {summaryError}
                </div>
              )}
              <TopicSummary
                summary={selectedSummary!}
                trendName={currentContext.trendName}
                onBack={handleSummaryClose}
                disabled={isRefreshing || isLoadingSummary}
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-gray-500">
              <p>{summaryFallbackMessage}</p>
              {summaryError && (
                <button
                  type="button"
                  onClick={handleSummaryRefresh}
                  disabled={isRefreshing || isLoadingSummary}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Tentar novamente
                </button>
              )}
            </div>
          )}
        </div>
        <div
          className={`border-t border-gray-200 bg-gray-50 ${footerPadding} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div className="text-xs text-gray-500">{footerLabel}</div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleSummaryRefresh}
              disabled={isRefreshing || isLoadingSummary}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              onClick={handleShare}
              disabled={!hasSummary || isLoadingSummary}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Share2 className="w-4 h-4" />
              Compartilhar
            </button>
          </div>
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
            <p className="text-xs text-gray-500">Tap to explore trends & topics</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleStartTrends}
              disabled={isLoadingTrends}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlayCircle className={`h-4 w-4 ${isLoadingTrends ? 'animate-pulse' : ''}`} />
              Start
            </button>
            <button
              onClick={() => loadTrends(true)}
              disabled={!hasRequestedTrends || isLoadingTrends}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingTrends ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleCancelTrends}
              disabled={!isLoadingTrends}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cancel current request"
            >
              <StopCircle className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      </div>

      {renderConnectionBanner()}

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button
                onClick={() => loadTrends(true)}
                className="mt-2 text-sm text-red-700 font-medium hover:text-red-800"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {isLoadingTrends && trends.length === 0 ? (
          <TrendSkeleton />
        ) : !hasRequestedTrends && trends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <PlayCircle className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Ready to explore?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Start a manual request to fetch the latest trends from the assistant only when you need it.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleStartTrends}
                disabled={isLoadingTrends}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlayCircle className={`h-4 w-4 ${isLoadingTrends ? 'animate-pulse' : ''}`} />
                Start exploring
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
                className={`w-full transition-transform duration-300 ease-in-out ${selectedTopic ? '-translate-x-full' : 'translate-x-0'}`}
              >
                <div className="space-y-3 pb-8">{renderTrendList()}</div>
              </div>
              <div
                className={`absolute inset-0 w-full transition-transform duration-300 ease-in-out ${selectedTopic ? 'translate-x-0' : 'translate-x-full'}`}
              >
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

      <FloatingChat
        context={currentContext}
        isProcessing={isChatProcessing}
        connectionState={chatConnectionState}
        connectionError={connectionError}
        onReconnect={handleReconnect}
        onSendMessage={handleChatMessage}
        messages={chatMessages}
      />
    </div>
  );
}
