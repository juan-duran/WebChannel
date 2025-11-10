import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TrendCard } from '../components/tap/TrendCard';
import { SummaryOverlay } from '../components/tap/SummaryOverlay';
import { FloatingChat } from '../components/tap/FloatingChat';
import { LoadingProgress, TrendSkeleton } from '../components/tap/LoadingProgress';
import { tapNavigationService } from '../lib/tapNavigationService';
import { websocketService } from '../lib/websocket';
import { TrendData, TopicData, SummaryData } from '../types/tapNavigation';
import { ChatMessage, generateMessageId } from '../lib/chatService';

export function TapNavigationPage() {
  const { user } = useAuth();
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
  const [topicsMap, setTopicsMap] = useState<Record<string, TopicData[]>>({});
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
      return;
    }

    setExpandedTrendId(trend.id);
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
    setCurrentContext({});
  };

  const handleTopicSelect = async (topic: TopicData) => {
    if (!user?.id) return;

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
    setSelectedSummary(null);
    const trend = trends.find((t) => t.id === expandedTrendId);
    setCurrentContext(trend ? { trendName: trend.title } : {});
  };

  const handleSummaryRefresh = async () => {
    if (!selectedSummary || !user?.id) return;

    try {
      setIsRefreshing(true);
      const topicRank = parseInt(selectedSummary.topicName.match(/\d+/)?.[0] || '1');
      const result = await tapNavigationService.fetchSummary(topicRank, user.id, { forceRefresh: true });

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
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

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 animate-fadeIn">
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
          <div className="space-y-3">
            {trends.map((trend) => (
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
            ))}
          </div>
        )}
      </div>

      {isLoadingSummary && (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
          <LoadingProgress />
        </div>
      )}

      {selectedSummary && !isLoadingSummary && (
        <SummaryOverlay
          summary={selectedSummary}
          isRefreshing={isRefreshing}
          fromCache={summaryFromCache}
          onClose={handleSummaryClose}
          onRefresh={handleSummaryRefresh}
          onShare={handleShare}
        />
      )}

      <FloatingChat
        context={currentContext}
        isProcessing={isChatProcessing}
        onSendMessage={handleChatMessage}
        messages={chatMessages}
      />
    </div>
  );
}
