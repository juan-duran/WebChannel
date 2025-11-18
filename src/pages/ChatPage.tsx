import { useState, useRef, useEffect } from 'react';
import { MessageCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { TypingIndicator } from '../components/TypingIndicator';
import { QuickActions } from '../components/QuickActions';
import { TrendsList, Trend } from '../components/TrendsList';
import { TopicsList, Topic } from '../components/TopicsList';
import { TopicSummary } from '../components/TopicSummary';
import type { SourceData, SummaryData } from '../types/tapNavigation';
import {
  ChatMessage,
  sendMessageToAgent,
  generateMessageId,
  saveMessageToDatabase,
  loadMessagesFromDatabase,
  getOrCreateDefaultChannel
} from '../lib/chatService';
import { parseAgentResponse, extractResponseText } from '../lib/responseParser';
import { supabase } from '../lib/supabase';

export function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState<Date | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [currentContext, setCurrentContext] = useState<{ trendName?: string; topicName?: string }>({});
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isUserNearBottomRef = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isUserNearBottomRef.current) {
      scrollToBottom();
    }
  }, [messages.length, isProcessing]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;

    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    isUserNearBottomRef.current = distanceFromBottom < 100;
  };

  useEffect(() => {
    const initializeChannel = async () => {
      if (!user?.id) return;

      setIsLoadingHistory(true);
      const channelId = await getOrCreateDefaultChannel(user.id);

      if (channelId) {
        setCurrentChannelId(channelId);
        const history = await loadMessagesFromDatabase(channelId);
        setMessages(history);
      }

      setIsLoadingHistory(false);
    };

    initializeChannel();
  }, [user]);

  useEffect(() => {
    if (!currentChannelId) return;

    const subscription = supabase
      .channel(`chat_messages:${currentChannelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${currentChannelId}`
        },
        (payload) => {
          (async () => {
            const newMessage = payload.new;

            const chatMessage: ChatMessage = {
              id: newMessage.id,
              role: newMessage.role as 'user' | 'assistant',
              content: newMessage.content,
              timestamp: new Date(newMessage.created_at),
              status: newMessage.status as 'sending' | 'sent' | 'error',
              contentType: newMessage.content_type as 'text' | 'trends' | 'topics' | 'summary',
              structuredData: newMessage.structured_data,
              metadata: newMessage.metadata
            };

            setMessages(prev => {
              const exists = prev.some(msg => msg.id === chatMessage.id);
              if (exists) return prev;
              return [...prev, chatMessage];
            });
          })();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentChannelId]);

  const handleSendMessage = async (content: string) => {
    if (!user?.id || isProcessing || !currentChannelId) return;

    setError(null);

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'sending'
    };

    setMessages(prev => [...prev, userMessage]);

    await saveMessageToDatabase(
      currentChannelId,
      user.id,
      'user',
      content
    );

    setMessages(prev =>
      prev.map(msg => (msg.id === userMessage.id ? { ...msg, status: 'sent' as const } : msg))
    );

    setIsProcessing(true);
    setProcessingStartTime(new Date());

    try {
      const response = await sendMessageToAgent({
        message: content,
        channelId: currentChannelId,
        userId: user.id
      });

      setIsProcessing(false);
      setProcessingStartTime(undefined);

      if (response.success && response.data) {
        const parsed = parseAgentResponse(response.data, currentContext);
        const aiContentFromResponse = extractResponseText(response.data);
        const aiContent =
          parsed.content && parsed.content.trim().length > 0 ? parsed.content : aiContentFromResponse;

        const aiMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: aiContent,
          timestamp: new Date(),
          contentType: parsed.type,
          structuredData:
            parsed.structuredData ??
            (parsed.type === 'trends'
              ? parsed.trends
              : parsed.type === 'topics'
              ? parsed.topics
              : parsed.type === 'summary'
              ? parsed.summary
              : undefined),
          metadata: parsed.metadata
        };

        await saveMessageToDatabase(
          currentChannelId,
          null,
          'assistant',
          aiContent,
          parsed.type,
          aiMessage.structuredData,
          aiMessage.metadata,
          response.data
        );

        setMessages(prev => [...prev, aiMessage]);
      } else {
        setError(response.error || 'Failed to get response from agent');
        setMessages(prev =>
          prev.map(msg =>
            msg.id === userMessage.id ? { ...msg, status: 'error' as const } : msg
          )
        );
      }
    } catch (err) {
      setIsProcessing(false);
      setProcessingStartTime(undefined);
      setError('An unexpected error occurred. Please try again.');
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id ? { ...msg, status: 'error' as const } : msg
        )
      );
    }
  };

  const handleRetry = () => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (lastUserMessage) {
      setMessages(prev => prev.filter(msg => msg.id !== lastUserMessage.id));
      handleSendMessage(lastUserMessage.content);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
    setIsProcessing(false);
    setProcessingStartTime(undefined);
    setCurrentContext({});
  };

  const handleTrendSelect = (trend: Trend) => {
    setCurrentContext({ trendName: trend.name });
    handleSendMessage(`Assunto #${trend.number}`);
  };

  const handleTopicSelect = (topic: Topic) => {
    setCurrentContext(prev => ({ ...prev, topicName: topic.name }));
    handleSendMessage(`Tópico #${topic.number}`);
  };

  const handleBackToTrends = () => {
    setCurrentContext({});
    handleSendMessage('assuntos');
  };

  const handleBackToTopics = () => {
    const trendName = currentContext.trendName;
    setCurrentContext({ trendName });

    const lastTrendMessage = [...messages].reverse().find(
      msg => msg.role === 'user' && msg.content.match(/^Assunto #\d+$/)
    );
    if (lastTrendMessage) {
      handleSendMessage(lastTrendMessage.content);
    }
  };

  if (isLoadingHistory) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-3" />
          <p className="text-gray-600">Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
      <div className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">WebChannel</h1>
              <p className="text-xs text-gray-500">
                {isProcessing ? 'Processing...' : 'Ready to help'}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              disabled={isProcessing}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && !isProcessing && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                <MessageCircle className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to WebChannel
              </h2>
              <p className="text-gray-600 mb-8 max-w-md">
                Ask me anything! I'm here to help you with your questions.
              </p>
              <QuickActions onSelect={handleSendMessage} disabled={isProcessing} />
            </div>
          )}

          {messages.map(message => {
            if (message.role === 'assistant') {
              if (message.contentType === 'trends' && message.structuredData) {
                return (
                  <div key={message.id} className="mb-4">
                    <MessageBubble message={{ ...message, content: '' }} />
                    <div className="max-w-[85%] sm:max-w-[75%] animate-fadeIn">
                      <TrendsList
                        summary={
                          typeof message.metadata?.trendsSummary === 'string'
                            ? message.metadata.trendsSummary
                            : undefined
                        }
                        trends={message.structuredData as Trend[]}
                        onSelect={handleTrendSelect}
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                );
              }

              if (message.contentType === 'topics' && message.structuredData) {
                return (
                  <div key={message.id} className="mb-4">
                    <MessageBubble message={{ ...message, content: '' }} />
                    <div className="max-w-[85%] sm:max-w-[75%] animate-fadeIn">
                      <TopicsList
                        topics={message.structuredData as Topic[]}
                        trendName={message.metadata?.trendName || currentContext.trendName || 'Assunto'}
                        onSelect={handleTopicSelect}
                        onBack={handleBackToTrends}
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                );
              }

              if (message.contentType === 'summary') {
                const structured =
                  message.structuredData &&
                  typeof message.structuredData === 'object' &&
                  !Array.isArray(message.structuredData)
                    ? (message.structuredData as Record<string, any>)
                    : undefined;

                const structuredSummary =
                  structured && structured.summary && typeof structured.summary === 'object' && !Array.isArray(structured.summary)
                    ? (structured.summary as Record<string, any>)
                    : structured;

                const summaryText = [
                  structuredSummary && typeof structuredSummary.content === 'string'
                    ? (structuredSummary.content as string)
                    : undefined,
                  structuredSummary && typeof structuredSummary.summary === 'string'
                    ? (structuredSummary.summary as string)
                    : undefined,
                  message.content,
                ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

                const summaryWhyItMatters = [
                  structuredSummary && typeof structuredSummary.whyItMatters === 'string'
                    ? (structuredSummary.whyItMatters as string)
                    : undefined,
                  structuredSummary && typeof structuredSummary.why_it_matters === 'string'
                    ? (structuredSummary.why_it_matters as string)
                    : undefined,
                  typeof message.metadata?.whyItMatters === 'string' ? message.metadata.whyItMatters : undefined,
                ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

                const normalizeSources = (value: unknown): SourceData[] => {
                  if (!value) return [];
                  if (Array.isArray(value)) {
                    return value
                      .map((item) => {
                        if (typeof item === 'string') {
                          return { title: item, url: item } satisfies SourceData;
                        }

                        if (!item || typeof item !== 'object') {
                          return null;
                        }

                        const maybeUrl =
                          typeof (item as any).url === 'string'
                            ? (item as any).url
                            : typeof (item as any).link === 'string'
                            ? (item as any).link
                            : undefined;

                        if (!maybeUrl) {
                          return null;
                        }

                        const maybeTitle =
                          typeof (item as any).title === 'string'
                            ? (item as any).title
                            : typeof (item as any).name === 'string'
                            ? (item as any).name
                            : undefined;

                        const maybeDate = [
                          typeof (item as any).publishedAt === 'string' ? (item as any).publishedAt : undefined,
                          typeof (item as any).published_at === 'string' ? (item as any).published_at : undefined,
                          typeof (item as any).date === 'string' ? (item as any).date : undefined,
                        ].find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);

                        return {
                          title: maybeTitle || maybeUrl,
                          url: maybeUrl,
                          ...(maybeDate ? { publishedAt: maybeDate } : {}),
                        } satisfies SourceData;
                      })
                      .filter((item): item is SourceData => Boolean(item));
                  }

                  if (typeof value === 'string') {
                    return [{ title: value, url: value }];
                  }

                  return [];
                };

                const candidateSources = [
                  structuredSummary && 'sources' in structuredSummary ? (structuredSummary as any).sources : undefined,
                  structuredSummary && 'references' in structuredSummary ? (structuredSummary as any).references : undefined,
                  structuredSummary && 'links' in structuredSummary ? (structuredSummary as any).links : undefined,
                  structuredSummary && 'sourceList' in structuredSummary ? (structuredSummary as any).sourceList : undefined,
                  message.metadata && Array.isArray((message.metadata as any).sources)
                    ? (message.metadata as any).sources
                    : undefined,
                ];

                const summarySources = candidateSources
                  .flatMap((value) => normalizeSources(value))
                  .filter((source, index, self) => index === self.findIndex((item) => item.url === source.url && item.title === source.title));

                const toStringArray = (value: unknown): string[] => {
                  if (!value) return [];
                  if (Array.isArray(value)) {
                    return value
                      .map((item) => (typeof item === 'string' ? item : undefined))
                      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
                  }
                  if (typeof value === 'string' && value.trim().length > 0) {
                    return [value];
                  }
                  return [];
                };

                const likesData = [
                  structuredSummary && structuredSummary['likes-data'],
                  structuredSummary && structuredSummary.likesData,
                  typeof message.metadata?.likesData === 'string' ? message.metadata.likesData : undefined,
                ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

                const contextItems = Array.from(
                  new Set(
                    [
                      ...toStringArray(structuredSummary?.context),
                      ...toStringArray(structuredSummary?.background),
                      ...toStringArray(message.metadata?.context),
                    ],
                  ),
                );

                const debateItems = Array.from(
                  new Set(
                    [
                      ...toStringArray(structuredSummary?.debate),
                      ...toStringArray(structuredSummary?.arguments),
                      ...toStringArray(message.metadata?.debate),
                    ],
                  ),
                );

                const personalization = [
                  structuredSummary && structuredSummary.personalization,
                  typeof message.metadata?.personalization === 'string' ? message.metadata.personalization : undefined,
                ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

                const thesisText = [
                  structuredSummary && structuredSummary.thesis,
                  summaryText,
                ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

                const topicName = [
                  structuredSummary && structuredSummary.topicName,
                  message.metadata?.topicName,
                  currentContext.topicName,
                ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

                const summaryData: SummaryData = {
                  topicName: topicName || 'Tópico',
                  likesData: likesData || '',
                  context: contextItems,
                  thesis: thesisText || '',
                  debate: debateItems,
                  personalization: personalization || '',
                  ...(summaryWhyItMatters ? { whyItMatters: summaryWhyItMatters } : {}),
                  ...(summarySources.length > 0 ? { sources: summarySources } : {}),
                };

                const trendLabel =
                  (typeof message.metadata?.trendName === 'string' && message.metadata.trendName.trim().length > 0
                    ? message.metadata.trendName
                    : undefined) || currentContext.trendName || 'Assunto';

                return (
                  <div key={message.id} className="mb-4">
                    <div className="max-w-[85%] sm:max-w-[75%] animate-fadeIn">
                      <TopicSummary
                        summary={summaryData}
                        trendName={trendLabel}
                        onBack={handleBackToTopics}
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                );
              }
            }

            return <MessageBubble key={message.id} message={message} />;
          })}

          {error && (
            <div className="flex justify-center mb-4 animate-fadeIn">
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 shadow-sm max-w-[85%] sm:max-w-[75%]">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-900 font-medium mb-1">Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                    <button
                      onClick={handleRetry}
                      disabled={isProcessing}
                      className="mt-3 flex items-center gap-2 text-sm text-red-700 hover:text-red-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <MessageInput
        onSend={handleSendMessage}
        disabled={isProcessing}
        placeholder={isProcessing ? 'Please wait...' : 'Type a message...'}
        onFocus={scrollToBottom}
      />
    </div>
  );
}
