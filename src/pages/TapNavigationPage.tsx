import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Share2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TrendCard } from '../components/tap/TrendCard';
import { FloatingChat } from '../components/tap/FloatingChat';
import { LoadingProgress, TrendSkeleton } from '../components/tap/LoadingProgress';
import { tapNavigationService } from '../lib/tapNavigationService';
import { websocketService } from '../lib/websocket';
import { TrendData, TopicData, SummaryData } from '../types/tapNavigation';
import { ChatMessage, generateMessageId } from '../lib/chatService';
import { TopicSummary } from '../components/TopicSummary';

export function TapNavigationPage() {
  const { user } = useAuth();
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
  const [topicsMap, setTopicsMap] = useState<Record<string, TopicData[]>>({});
  const [selectedTopic, setSelectedTopic] = useState<TopicData | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<SummaryData | null>(null);
  const [summaryFromCache, setSummaryFromCache] = useState(false);

  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatProcessing, setIsChatProcessing] = useState(false);

  const [currentContext, setCurrentContext] = useState<{ trendName?: string; topicName?: string }>({});

  useEffect(() => {
    loadTrends();
  }, []);

  useEffect(() => {
    if (!user) return;

    websocketService.connect().catch((error) => {
      console.error('Failed to connect WebSocket:', error);
    });

    return () => {
      websocketService.disconnect();
    };
  }, [user]);

  const loadTrends = async (forceRefresh = false) => {
    try {
      setIsLoadingTrends(true);
      setError(null);

      const result = await tapNavigationService.fetchTrends({ forceRefresh });

      if (result.success && result.data) {
        setTrends(result.data as TrendData[]);
      } else {
        setError(result.error || 'Failed to load trends');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingTrends(false);
    }
  };

  const handleTrendExpand = async (trend: TrendData) => {
    if (expandedTrendId === trend.id) {
      setExpandedTrendId(null);
      setSelectedTopic(null);
      setSelectedSummary(null);
      setSummaryFromCache(false);
      setCurrentContext({});
      return;
    }

    setExpandedTrendId(trend.id);
    setSelectedTopic(null);
    setSelectedSummary(null);
    setSummaryFromCache(false);
    setCurrentContext({ trendName: trend.title });

    if (topicsMap[trend.id]) {
      return;
    }

    try {
      setIsLoadingTopics(true);
      const result = await tapNavigationService.fetchTopics(trend.rank);

      if (result.success && result.data) {
        setTopicsMap((prev) => ({
          ...prev,
          [trend.id]: result.data as TopicData[],
        }));
      }
    } catch (err) {
      console.error('Error loading topics:', err);
    } finally {
      setIsLoadingTopics(false);
    }
  };

  const handleTrendCollapse = () => {
    setExpandedTrendId(null);
    setSelectedTopic(null);
    setSelectedSummary(null);
    setSummaryFromCache(false);
    setCurrentContext({});
  };

  const handleTopicSelect = async (topic: TopicData) => {
    if (!user?.id) return;

    setSelectedTopic(topic);
    setSelectedSummary(null);
    setSummaryFromCache(false);

    const trend = trends.find((t) => t.id === expandedTrendId);
    setCurrentContext({
      trendName: trend?.title || '',
      topicName: topic.title,
    });

    try {
      setIsLoadingSummary(true);
      const result = await tapNavigationService.fetchSummary(topic.rank, user.id);

      if (result.success && result.data) {
        setSelectedSummary(result.data as SummaryData);
        setSummaryFromCache(result.fromCache || false);
      }
    } catch (err) {
      console.error('Error loading summary:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleSummaryClose = () => {
    setSelectedTopic(null);
    setSelectedSummary(null);
    setSummaryFromCache(false);
    const trend = trends.find((t) => t.id === expandedTrendId);
    setCurrentContext(trend ? { trendName: trend.title } : {});
  };

  const handleSummaryRefresh = async () => {
    if (!selectedTopic || !user?.id) return;

    try {
      setIsRefreshing(true);
      const result = await tapNavigationService.fetchSummary(selectedTopic.rank, user.id, { forceRefresh: true });

      if (result.success && result.data) {
        setSelectedSummary(result.data as SummaryData);
        setSummaryFromCache(false);
      }
    } catch (err) {
      console.error('Error refreshing summary:', err);
    } finally {
      setIsRefreshing(false);
    }
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

  const handleChatMessage = (content: string) => {
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
      websocketService.sendMessage(content);
    } catch (err) {
      console.error('Error sending message:', err);
      setIsChatProcessing(false);
    }
  };

  const renderTrendList = () =>
    trends.map((trend) => (
      <TrendCard
        key={trend.id}
        trend={trend}
        isExpanded={expandedTrendId === trend.id}
        topics={topicsMap[trend.id] || null}
        isLoadingTopics={isLoadingTopics && expandedTrendId === trend.id}
        onExpand={() => handleTrendExpand(trend)}
        onCollapse={handleTrendCollapse}
        onTopicSelect={handleTopicSelect}
      />
    ));

  const renderSummaryContent = (variant: 'mobile' | 'desktop') => {
    const baseClasses =
      variant === 'desktop'
        ? 'h-full flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm'
        : 'h-full flex flex-col bg-white rounded-2xl shadow-lg';
    const contentPadding = variant === 'desktop' ? 'px-6 pt-6 pb-4' : 'px-4 pt-4 pb-4';
    const footerPadding = variant === 'desktop' ? 'px-6 py-4' : 'px-4 py-3';

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

    return (
      <div className={baseClasses}>
        <div className={`flex-1 overflow-y-auto ${contentPadding}`}>
          {isLoadingSummary ? (
            <LoadingProgress message="Carregando resumo..." />
          ) : hasSummary ? (
            <>
              {summaryFromCache && (
                <div className="mb-4 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700">
                  Exibindo uma versão em cache. Toque em atualizar para gerar uma nova visão.
                </div>
              )}
              <TopicSummary
                topicName={selectedSummary!.topicName}
                trendName={selectedSummary!.trendName}
                content={selectedSummary!.content}
                date={new Date(selectedSummary!.lastUpdated).toLocaleDateString('pt-BR')}
                onBack={handleSummaryClose}
                disabled={isRefreshing || isLoadingSummary}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-gray-500">
              Não foi possível carregar o resumo. Tente novamente.
            </div>
          )}
        </div>
        <div
          className={`border-t border-gray-200 bg-gray-50 ${footerPadding} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div className="text-xs text-gray-500">
            {lastUpdatedLabel ? `Última atualização ${lastUpdatedLabel}` : 'Preparando resumo...'}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleSummaryRefresh}
              disabled={!hasSummary || isRefreshing || isLoadingSummary}
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
        onSendMessage={handleChatMessage}
        messages={chatMessages}
      />
    </div>
  );
}
