import { useState, useEffect, useRef } from 'react';
import { RefreshCw, AlertCircle, Share2, WifiOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TrendCard } from '../components/tap/TrendCard';
import { FloatingChat } from '../components/tap/FloatingChat';
import { LoadingProgress, TrendSkeleton } from '../components/tap/LoadingProgress';
import { tapNavigationService } from '../lib/tapNavigationService';
import { websocketService, type WebSocketMessage } from '../lib/websocket';
import { TrendData, TopicData, SummaryData } from '../types/tapNavigation';
import { ChatMessage, generateMessageId } from '../lib/chatService';
import { TopicSummary } from '../components/TopicSummary';

export function TapNavigationPage() {
  const { user } = useAuth();
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
  const [topicsMap, setTopicsMap] = useState<Record<string, TopicData[]>>({});
  const [topicsErrorMap, setTopicsErrorMap] = useState<Record<string, string | null>>({});
  const [selectedTopic, setSelectedTopic] = useState<TopicData | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<SummaryData | null>(null);
  const [summaryFromCache, setSummaryFromCache] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [loadingTopicsTrendId, setLoadingTopicsTrendId] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatProcessing, setIsChatProcessing] = useState(false);

  const [currentContext, setCurrentContext] = useState<{ trendName?: string; topicName?: string }>({});
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [chatConnectionState, setChatConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(
    'disconnected',
  );

  const trendRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mobileSummaryContentRef = useRef<HTMLDivElement | null>(null);
  const desktopSummaryContentRef = useRef<HTMLDivElement | null>(null);

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
    loadTrends();
  }, []);

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
      setConnectionStatus('error');
      setConnectionError(message.error || 'Conexão perdida. Tente reconectar.');
      setChatConnectionState(websocketService.getConnectionState());
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
          setChatConnectionState('error');
        });

    attemptConnection();

    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('error', handleError);
      websocketService.disconnect();
      setChatConnectionState('disconnected');
    };
  }, [user]);

  const loadTrends = async (forceRefresh = false) => {
    if (forceRefresh) {
      resetSelectionState();
      setTopicsMap({});
      setTopicsErrorMap({});
      trendRefs.current = {};
    }
    try {
      setIsLoadingTrends(true);
      setError(null);

      const result = await tapNavigationService.fetchTrends({ forceRefresh });

      if (result.success && result.data) {
        setTrends(result.data as TrendData[]);
        if (result.error) {
          setError(result.error);
        }
      } else {
        setError(result.error || 'Failed to load trends');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingTrends(false);
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
      const result = await tapNavigationService.fetchTopics(trend.rank, options);

      if (result.success && Array.isArray(result.data)) {
        setTopicsMap((prev) => ({
          ...prev,
          [trend.id]: result.data as TopicData[],
        }));
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
    setCurrentContext({ trendName: trend.title });

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
    setCurrentContext({
      trendName: trend?.title || '',
      topicName: topic.title,
    });

    requestAnimationFrame(scrollSummaryToTop);

    try {
      setIsLoadingSummary(true);
      const result = await tapNavigationService.fetchSummary(topic.rank, user.id);

      if (result.success && result.data) {
        setSelectedSummary(result.data as SummaryData);
        setSummaryFromCache(result.fromCache || false);
        setSummaryError(result.error ?? null);
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
    setCurrentContext(trend ? { trendName: trend.title } : {});
  };

  const handleSummaryRefresh = async () => {
    if (!selectedTopic || !user?.id) return;

    try {
      setIsRefreshing(true);
      setSummaryError(null);
      const result = await tapNavigationService.fetchSummary(selectedTopic.rank, user.id, { forceRefresh: true });

      if (result.success && result.data) {
        setSelectedSummary(result.data as SummaryData);
        setSummaryFromCache(false);
        setSummaryError(result.error ?? null);
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
        setChatConnectionState('error');
      });
  };

  const handleShare = async () => {
    if (!selectedSummary) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: selectedSummary.topicName,
          text: selectedSummary.summary || selectedSummary.content.substring(0, 200),
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
    const lastUpdatedLabel = hasSummary
      ? new Date(selectedSummary!.lastUpdated).toLocaleString('pt-BR')
      : null;
    const summaryFallbackMessage = summaryError || 'Não foi possível carregar o resumo. Tente novamente.';

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
                topicName={selectedSummary!.topicName}
                trendName={selectedSummary!.trendName}
                content={selectedSummary!.content}
                date={new Date(selectedSummary!.lastUpdated).toLocaleDateString('pt-BR')}
                onBack={handleSummaryClose}
                disabled={isRefreshing || isLoadingSummary}
                whyItMatters={selectedSummary!.whyItMatters}
                sources={selectedSummary!.sources}
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
          <div className="text-xs text-gray-500">
            {lastUpdatedLabel
              ? `Última atualização ${lastUpdatedLabel}`
              : summaryError
              ? 'Erro ao carregar resumo'
              : 'Preparando resumo...'}
          </div>
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
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quenty</h1>
            <p className="text-xs text-gray-500">Tap to explore trends & topics</p>
          </div>
          <button
            onClick={() => loadTrends(true)}
            disabled={isLoadingTrends}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoadingTrends ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {connectionStatus === 'error' && (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-amber-800">
              <WifiOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Conexão com o assistente perdida</p>
                <p className="text-xs text-amber-700">{connectionError || 'Não foi possível se comunicar com o assistente em tempo real.'}</p>
              </div>
            </div>
            <button
              onClick={handleReconnect}
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold text-amber-900 bg-white border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              Tentar reconectar
            </button>
          </div>
        </div>
      )}

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
        ) : (
          <>
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
        onSendMessage={handleChatMessage}
        messages={chatMessages}
      />
    </div>
  );
}
