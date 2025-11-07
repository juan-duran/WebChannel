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
import { ConnectionStatus } from '../components/ConnectionStatus';
import { MediaMessage } from '../components/MediaMessage';
import {
  ChatMessage,
  generateMessageId,
  loadMessagesFromDatabase,
  getOrCreateDefaultChannel
} from '../lib/chatService';
import { parseAgentResponse } from '../lib/responseParser';
import { websocketService, WebSocketMessage } from '../lib/websocket';

export function ChatPageWebSocket() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState<Date | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [currentContext, setCurrentContext] = useState<{ trendName?: string; topicName?: string }>({});
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

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
    if (!user) return;

    const connectWebSocket = async () => {
      try {
        setConnectionStatus('connecting');
        await websocketService.connect();
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setConnectionStatus('error');
      }
    };

    connectWebSocket();

    const handleMessage = (message: WebSocketMessage) => {
      if (message.type === 'typing_start') {
        setIsProcessing(true);
        setProcessingStartTime(new Date());
      } else if (message.type === 'typing_stop') {
        setIsProcessing(false);
        setProcessingStartTime(undefined);
      } else if (message.type === 'message' && message.role === 'assistant') {
        setIsProcessing(false);
        setProcessingStartTime(undefined);

        const parsed = parseAgentResponse(message.content || '', currentContext);

        const aiMessage: ChatMessage = {
          id: message.correlationId || generateMessageId(),
          role: 'assistant',
          content: message.content || '',
          timestamp: new Date(),
          contentType: message.contentType || parsed.type,
          structuredData: message.structuredData || (parsed.type === 'trends' ? parsed.trends : parsed.type === 'topics' ? parsed.topics : undefined),
          metadata: message.metadata || parsed.metadata,
        };

        setMessages(prev => [...prev, aiMessage]);
        setError(null);
      } else if (message.type === 'error') {
        setIsProcessing(false);
        setProcessingStartTime(undefined);
        setError(message.error || 'An error occurred');
      }
    };

    websocketService.on('message', handleMessage);
    websocketService.on('typing_start', handleMessage);
    websocketService.on('typing_stop', handleMessage);
    websocketService.on('error', handleMessage);

    return () => {
      websocketService.off('message', handleMessage);
      websocketService.off('typing_start', handleMessage);
      websocketService.off('typing_stop', handleMessage);
      websocketService.off('error', handleMessage);
      websocketService.disconnect();
    };
  }, [user, currentContext]);

  useEffect(() => {
    const checkConnection = setInterval(() => {
      setConnectionStatus(websocketService.getConnectionState());
    }, 1000);

    return () => clearInterval(checkConnection);
  }, []);

  const handleSendMessage = async (content: string) => {
    if (!user?.id || isProcessing || connectionStatus !== 'connected') return;

    setError(null);

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'sending'
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      websocketService.sendMessage(content);

      setMessages(prev =>
        prev.map(msg => (msg.id === userMessage.id ? { ...msg, status: 'sent' as const } : msg))
      );

      setIsProcessing(true);
      setProcessingStartTime(new Date());

    } catch (err: any) {
      setError(err.message || 'Failed to send message');
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

  const handleReconnect = async () => {
    try {
      setConnectionStatus('connecting');
      await websocketService.connect();
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('error');
    }
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
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-3" />
          <p className="text-gray-600">Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-blue-50 to-white">
      <ConnectionStatus status={connectionStatus} onReconnect={handleReconnect} />

      <div className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">WebChannel</h1>
              <p className="text-xs text-gray-500">
                {isProcessing ? 'Quenty-AI is thinking...' : connectionStatus === 'connected' ? 'Ready to help' : 'Connecting...'}
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
        className="flex-1 min-h-0 overflow-y-auto px-4 py-6"
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
              <QuickActions onSelect={handleSendMessage} disabled={isProcessing || connectionStatus !== 'connected'} />
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
                return (
                  <div key={message.id} className="mb-4">
                    <div className="max-w-[85%] sm:max-w-[75%] animate-fadeIn">
                      <TopicSummary
                        topicName={currentContext.topicName || 'Tópico'}
                        trendName={currentContext.trendName || 'Assunto'}
                        content={message.content}
                        date={message.timestamp.toLocaleDateString('pt-BR')}
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

          {isProcessing && <TypingIndicator startTime={processingStartTime} />}

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
        disabled={isProcessing || connectionStatus !== 'connected'}
        placeholder={isProcessing ? 'Quenty-AI is thinking...' : connectionStatus !== 'connected' ? 'Connecting...' : 'Type a message...'}
      />
    </div>
  );
}
