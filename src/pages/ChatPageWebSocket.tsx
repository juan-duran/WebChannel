import { useState, useRef, useEffect } from 'react';
import { MessageCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { TypingIndicator } from '../components/TypingIndicator';
import { TrendsList, Trend } from '../components/TrendsList';
import { TopicsList, Topic } from '../components/TopicsList';
import { parseTopicText } from '../lib/responseParser';
import { TopicSummary } from '../components/TopicSummary';
import { ConnectionStatus } from '../components/ConnectionStatus';
import {
  ChatMessage,
  MessageButton,
  generateMessageId,
  loadMessagesFromDatabase,
  getOrCreateDefaultChannel
} from '../lib/chatService';
import { safeJsonParse } from '../lib/safeJsonParse';
import { websocketService, WebSocketMessage } from '../lib/websocket';
import type { SourceData, SummaryData } from '../types/tapNavigation';

const allowedAssistantContentTypes: ChatMessage['contentType'][] = ['text', 'trends', 'topics', 'summary'];

export function inferContentTypeFromStructuredData(
  structuredData: unknown
): ChatMessage['contentType'] | undefined {
  if (!structuredData) {
    return undefined;
  }

  if (Array.isArray(structuredData)) {
    return undefined;
  }

  if (typeof structuredData === 'object') {
    const layer = (structuredData as any).layer;
    if (
      typeof layer === 'string' &&
      (allowedAssistantContentTypes as string[]).includes(layer) &&
      layer !== 'text'
    ) {
      return layer as ChatMessage['contentType'];
    }

    if (Array.isArray((structuredData as any).trends)) {
      return 'trends';
    }

    if (Array.isArray((structuredData as any).topics)) {
      return 'topics';
    }

    if ((structuredData as any).summary && typeof (structuredData as any).summary === 'object') {
      return 'summary';
    }
  }

  return undefined;
}

export function ChatPageWebSocket() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState<Date | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
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
        if (error instanceof Error && error.message === 'WebSocket connection intentionally closed') {
          return;
        }
        console.error('Failed to connect WebSocket:', error);
        setConnectionStatus('error');
      }
    };

    connectWebSocket();

    const handleMessage = (message: WebSocketMessage) => {
      if (message.type === 'connected') {
        setConnectionStatus('connected');
        setError(null);
        return;
      }

      if (message.type === 'typing_start') {
        setIsProcessing(true);
        setProcessingStartTime(new Date());
        return;
      }

      if (message.type === 'typing_stop') {
        setIsProcessing(false);
        setProcessingStartTime(undefined);
        return;
      }

      if (message.type === 'error') {
        setIsProcessing(false);
        setProcessingStartTime(undefined);
        const errorMessage = message.error || 'An error occurred';

        if (errorMessage && /connection|reconectar/i.test(errorMessage)) {
          const nextState = /fechad|closed|perd/i.test(errorMessage) ? 'disconnected' : 'error';
          setConnectionStatus(nextState);
        }

        setError(errorMessage);
        return;
      }

      if (message.type !== 'message' || message.role !== 'assistant') {
        return;
      }

      setIsProcessing(false);
      setProcessingStartTime(undefined);

      const parsedContent = safeJsonParse<any>(message.content);
      const parsedType = typeof parsedContent?.type === 'string' ? parsedContent.type : undefined;
      const structuredDataCandidate =
        message.structuredData ??
        (message as any).structured_data ??
        (parsedContent && typeof parsedContent === 'object'
          ? (parsedContent as any).structuredData ?? (parsedContent as any).structured_data
          : undefined);
      const structuredDataType = inferContentTypeFromStructuredData(structuredDataCandidate);
      const rawContentType = (message as any).content_type ?? message.contentType;
      const resolvedContentType =
        (rawContentType && (allowedAssistantContentTypes as string[]).includes(rawContentType)
          ? (rawContentType as ChatMessage['contentType'])
          : undefined) ||
        (parsedType && (allowedAssistantContentTypes as string[]).includes(parsedType)
          ? (parsedType as ChatMessage['contentType'])
          : undefined) ||
        structuredDataType ||
        'text';

      const primaryButtons = parsedContent?.buttons ?? undefined;
      const fallbackButtons = message.buttons ?? undefined;

      const normalizeButtons = (buttons: any): MessageButton[] => {
        if (!Array.isArray(buttons)) {
          return [];
        }

        return buttons
          .map((button) => {
            if (!button) return null;

            if (typeof button === 'string') {
              return { label: button, value: button };
            }

            if (typeof button === 'object') {
              const label =
                (button as any).label || (button as any).title || (button as any).text || (button as any).name;
              const value = (button as any).value || (button as any).payload || (button as any).action;

              if (typeof label === 'string' && typeof value === 'string') {
                return { label, value };
              }
            }

            return null;
          })
          .filter((button): button is MessageButton => Boolean(button));
      };

      const mergedButtons = (() => {
        const parsedButtons = normalizeButtons(primaryButtons);
        if (parsedButtons.length > 0) {
          return parsedButtons;
        }

        const extraButtons = normalizeButtons(fallbackButtons);
        return extraButtons.length > 0 ? extraButtons : undefined;
      })();

      const aiMessage: ChatMessage = {
        id: message.correlationId || generateMessageId(),
        role: 'assistant',
        content: message.content || '',
        timestamp: new Date(),
        contentType: resolvedContentType,
        structuredData:
          parsedContent && Object.prototype.hasOwnProperty.call(parsedContent, 'items')
            ? parsedContent.items
            : structuredDataCandidate || null,
        metadata:
          message.metadata ||
          (parsedContent?.metadata && typeof parsedContent.metadata === 'object'
            ? parsedContent.metadata
            : parsedContent?.meta && typeof parsedContent.meta === 'object'
            ? parsedContent.meta
            : undefined),
        buttons: mergedButtons,
      };

      setMessages((prev) => [...prev, aiMessage]);
      setError(null);
    };

    websocketService.on('message', handleMessage);
    websocketService.on('connected', handleMessage);
    websocketService.on('typing_start', handleMessage);
    websocketService.on('typing_stop', handleMessage);
    websocketService.on('error', handleMessage);

    return () => {
      websocketService.off('message', handleMessage);
      websocketService.off('connected', handleMessage);
      websocketService.off('typing_start', handleMessage);
      websocketService.off('typing_stop', handleMessage);
      websocketService.off('error', handleMessage);
      websocketService.disconnect();
    };
  }, [user]);

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
      await websocketService.sendMessage(content);

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
    const command =
      (typeof trend.command === 'string' && trend.command.trim().length > 0 && trend.command.trim()) ||
      (typeof trend.value === 'string' && /^assunto\s*#/i.test(trend.value) ? trend.value.trim() : undefined) ||
      (Number.isFinite(trend.number) ? `Assunto #${trend.number}` : trend.name);
    if (!command) return;
    handleSendMessage(command);
  };

  const handleTopicSelect = (topic: Topic) => {
    const value = topic.value?.trim() || (Number.isFinite(topic.number) ? `Tópico #${topic.number}` : topic.name);
    if (!value) return;
    handleSendMessage(value);
  };

  const toTrimmedString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  };

  const pickFirstString = (...values: unknown[]): string | undefined => {
    for (const value of values) {
      const trimmed = toTrimmedString(value);
      if (trimmed) {
        return trimmed;
      }
    }
    return undefined;
  };

  const normalizeTrends = (data: any): Trend[] => {
    if (!Array.isArray(data)) {
      return [];
    }

    const trends: Trend[] = [];

    data.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const parseRank = (value: unknown): number | undefined => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === 'string') {
          const match = value.match(/\d+/);
          if (match) {
            const parsed = parseInt(match[0], 10);
            if (!Number.isNaN(parsed)) {
              return parsed;
            }
          }
        }
        return undefined;
      };

      const rank =
        parseRank((item as any).rank) ??
        parseRank((item as any).number) ??
        parseRank((item as any).position) ??
        index + 1;

      const rawName =
        toTrimmedString((item as any).title) ??
        toTrimmedString((item as any).name) ??
        toTrimmedString((item as any).label);

      const headline = toTrimmedString((item as any).headline);
      const description =
        toTrimmedString((item as any).summary) ?? toTrimmedString((item as any).description);
      const resolvedName = rawName ?? headline ?? description;

      if (!resolvedName) {
        return;
      }

      const metrics =
        toTrimmedString((item as any).value) ?? toTrimmedString((item as any).stats);

      const command =
        toTrimmedString((item as any).command) ??
        toTrimmedString((item as any).cta) ??
        (Number.isFinite(rank) ? `Assunto #${rank}` : undefined);

      const category =
        toTrimmedString((item as any).category) ?? toTrimmedString((item as any).type);

      const resolvedUrl =
        pickFirstString(
          (item as any).asset_short_url,
          (item as any).assetShortUrl,
          (item as any).assetShortURL,
          (item as any).asset_short_link,
          (item as any).assetShortLink,
          (item as any).asset_link,
          (item as any).assetLink,
          (item as any).short_url,
          (item as any).shortUrl,
          (item as any).url,
          (item as any).link,
          (item as any).href,
        ) ?? null;

      const assetType = pickFirstString((item as any).asset_type, (item as any).assetType);
      const assetThumbnail =
        pickFirstString(
          (item as any).asset_thumbnail,
          (item as any).assetThumbnail,
          (item as any).asset_thumbnail_url,
          (item as any).assetThumbnailUrl,
          (item as any).thumbnail,
          (item as any).image,
          (item as any).preview_image,
        ) ?? undefined;
      const assetTitle = pickFirstString((item as any).asset_title, (item as any).assetTitle);
      const assetDescription = pickFirstString(
        (item as any).asset_description,
        (item as any).assetDescription,
        (item as any).asset_summary,
      );
      const assetEmbedHtml = pickFirstString(
        (item as any).asset_embed_html,
        (item as any).assetEmbedHtml,
        (item as any).embed_html,
      );

      const whyItMatters =
        toTrimmedString((item as any).whyItMatters) ??
        toTrimmedString((item as any).why_it_matters) ??
        toTrimmedString((item as any).why);

      trends.push({
        id: typeof (item as any).id === 'string' ? (item as any).id : `trend_${rank ?? index + 1}`,
        number: rank ?? index + 1,
        name: resolvedName,
        headline: headline ?? (description && description !== resolvedName ? description : undefined),
        description: description && description !== headline ? description : undefined,
        category: category ?? undefined,
        value: command ?? undefined,
        command: command ?? undefined,
        metrics: metrics ?? undefined,
        url: resolvedUrl ?? undefined,
        whyItMatters: whyItMatters ?? undefined,
        ...(assetType || assetThumbnail || assetTitle || assetDescription || assetEmbedHtml || resolvedUrl
          ? {
              assetType,
              assetThumbnail,
              assetTitle,
              assetDescription,
              assetEmbedHtml,
              assetUrl: resolvedUrl ?? undefined,
            }
          : {}),
      });
    });

    return trends;
  };

  const normalizeTopics = (data: any): Topic[] => {
    if (!Array.isArray(data)) {
      return [];
    }

    const topics: Topic[] = [];

    data.forEach((item, index) => {
      if (typeof item === 'string') {
        const parsed = parseTopicText(item, index);
        if (parsed) {
          topics.push(parsed);
        }
        return;
      }

      if (!item || typeof item !== 'object') {
        return;
      }

      const rank =
        typeof (item as any).rank === 'number'
          ? (item as any).rank
          : typeof (item as any).number === 'number'
          ? (item as any).number
          : index + 1;

      const textParts = [
        typeof (item as any).title === 'string' ? (item as any).title : undefined,
        typeof (item as any).name === 'string' ? (item as any).name : undefined,
        typeof (item as any).label === 'string' ? (item as any).label : undefined,
        typeof (item as any).summary === 'string' ? (item as any).summary : undefined,
        typeof (item as any).description === 'string' ? (item as any).description : undefined,
        typeof (item as any).text === 'string' ? (item as any).text : undefined,
      ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);

      let parsed: Topic | null = null;
      if (textParts.length > 0) {
        const combined = Array.from(new Set(textParts.map((part) => part.trim()))).join(' — ');
        parsed = parseTopicText(combined, index);
      }

      const fallbackNumber = Number.isFinite(rank) ? (rank as number) : parsed?.number ?? index + 1;

      const id =
        typeof (item as any).id === 'string' && (item as any).id.trim().length > 0
          ? (item as any).id
          : `topic_${fallbackNumber}`;

      const value =
        typeof (item as any).value === 'string'
          ? (item as any).value
          : typeof (item as any).command === 'string'
          ? (item as any).command
          : parsed?.value ?? `Tópico #${fallbackNumber}`;

      const likesData =
        typeof (item as any)['likes-data'] === 'string'
          ? (item as any)['likes-data']
          : typeof (item as any).likesData === 'string'
          ? (item as any).likesData
          : typeof (item as any).engagement === 'string'
          ? (item as any).engagement
          : parsed?.likesData;

      const description =
        (parsed && parsed.description) ||
        (typeof (item as any).summary === 'string' ? (item as any).summary : undefined) ||
        (typeof (item as any).description === 'string' ? (item as any).description : undefined);

      const name = (parsed && parsed.name) || (textParts.length > 0 ? textParts[0].trim() : undefined);

      if (!name) {
        return;
      }

      topics.push({
        id,
        number: fallbackNumber,
        name,
        ...(description && description.trim().length > 0 && description.trim() !== name ? { description: description.trim() } : {}),
        value,
        ...(likesData && likesData.trim().length > 0 ? { likesData: likesData.trim() } : {}),
      });
    });

    return topics;
  };

  const renderButtons = (buttons?: MessageButton[]) => {
    if (!buttons || buttons.length === 0) {
      return null;
    }

    const disabled = isProcessing || connectionStatus !== 'connected';

    return (
      <div className="flex flex-wrap gap-2">
        {buttons.map((button, index) => (
          <button
            key={`${button.value}-${index}`}
            onClick={() => handleSendMessage(button.value)}
            disabled={disabled}
            className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {button.label}
          </button>
        ))}
      </div>
    );
  };

  const renderAssistantMessage = (message: ChatMessage) => {
    const parsedContent = safeJsonParse<any>(message.content);
    const isParsedObject = parsedContent && typeof parsedContent === 'object' && !Array.isArray(parsedContent);

    const textSegments: string[] = [];
    const collectText = (value: unknown) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        textSegments.push(value.trim());
      }
    };

    if (isParsedObject) {
      collectText(parsedContent.title);
      collectText(parsedContent.subtitle);
      collectText(parsedContent.message);
      collectText(parsedContent.text);
      collectText(parsedContent.description);
    }

    const bubbleText = textSegments.length > 0 ? Array.from(new Set(textSegments)).join('\n') : undefined;
    const structured = message.structuredData as any;
    const itemsFromParsed = isParsedObject ? parsedContent.items : undefined;
    const buttons = message.buttons;
    const disabled = isProcessing || connectionStatus !== 'connected';

    if (message.contentType === 'trends') {
      const rawItems = Array.isArray(itemsFromParsed)
        ? itemsFromParsed
        : Array.isArray(structured?.trends)
        ? structured.trends
        : Array.isArray(structured)
        ? structured
        : [];

      const trends = normalizeTrends(rawItems);

      if (trends.length === 0 && !bubbleText && (!buttons || buttons.length === 0)) {
        return null;
      }

      const structuredSummary =
        toTrimmedString((structured as any)?.trendsSummary) ??
        toTrimmedString((structured as any)?.trends_summary);
      const summaryText =
        typeof message.metadata?.trendsSummary === 'string'
          ? message.metadata.trendsSummary
          : structuredSummary ?? undefined;

      return (
        <div key={message.id} className="flex flex-col items-start gap-4">
          {bubbleText && <MessageBubble message={{ ...message, content: bubbleText }} />}
          {trends.length > 0 && (
            <div className="w-full animate-fadeIn">
              <TrendsList
                trends={trends}
                summary={summaryText}
                onSelect={handleTrendSelect}
                disabled={disabled}
              />
            </div>
          )}
          {renderButtons(buttons)}
        </div>
      );
    }

    if (message.contentType === 'topics') {
      const rawItems = Array.isArray(itemsFromParsed)
        ? itemsFromParsed
        : Array.isArray(structured?.topics)
        ? structured.topics
        : Array.isArray(structured)
        ? structured
        : [];

      const topics = normalizeTopics(rawItems);
      const trendName =
        (isParsedObject && typeof parsedContent.trendName === 'string' && parsedContent.trendName) ||
        (isParsedObject && typeof parsedContent.title === 'string' && parsedContent.title) ||
        (typeof message.metadata?.trendName === 'string' ? message.metadata.trendName : undefined) ||
        'Assunto';

      if (topics.length === 0 && !bubbleText && (!buttons || buttons.length === 0)) {
        return null;
      }

      return (
        <div key={message.id} className="flex flex-col items-start gap-4">
          {bubbleText && <MessageBubble message={{ ...message, content: bubbleText }} />}
          {topics.length > 0 && (
            <div className="w-full animate-fadeIn">
              <TopicsList topics={topics} trendName={trendName} onSelect={handleTopicSelect} disabled={disabled} />
            </div>
          )}
          {renderButtons(buttons)}
        </div>
      );
    }

    if (message.contentType === 'summary') {
      const structuredSummary =
        (isParsedObject && itemsFromParsed && typeof itemsFromParsed === 'object' && !Array.isArray(itemsFromParsed)
          ? itemsFromParsed
          : structured?.summary && typeof structured.summary === 'object'
          ? structured.summary
          : typeof structured === 'object' && structured && !Array.isArray(structured)
          ? structured
          : {}) || {};

      const topicName =
        (typeof structuredSummary.topicName === 'string' && structuredSummary.topicName) ||
        (isParsedObject && typeof parsedContent.topicName === 'string' && parsedContent.topicName) ||
        (typeof message.metadata?.topicName === 'string' ? message.metadata.topicName : undefined) ||
        'Tópico';

      const trendName =
        (typeof structuredSummary.trendName === 'string' && structuredSummary.trendName) ||
        (isParsedObject && typeof parsedContent.trendName === 'string' && parsedContent.trendName) ||
        (typeof message.metadata?.trendName === 'string' ? message.metadata.trendName : undefined) ||
        'Assunto';

      const summaryWhyItMatters = [
        structuredSummary.whyItMatters,
        structuredSummary.why_it_matters,
        isParsedObject ? parsedContent.whyItMatters : undefined,
        isParsedObject ? parsedContent.why_it_matters : undefined,
        typeof message.metadata?.whyItMatters === 'string' ? message.metadata.whyItMatters : undefined,
      ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

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

              const maybeTitle =
                typeof (item as any).title === 'string'
                  ? (item as any).title
                  : typeof (item as any).name === 'string'
                  ? (item as any).name
                  : undefined;

              const maybeUrl =
                typeof (item as any).url === 'string'
                  ? (item as any).url
                  : typeof (item as any).link === 'string'
                  ? (item as any).link
                  : undefined;

              if (!maybeUrl) {
                return null;
              }

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
        structuredSummary.sources,
        structuredSummary.references,
        structuredSummary.links,
        structuredSummary.sourceList,
        isParsedObject ? parsedContent.sources : undefined,
        isParsedObject ? parsedContent.references : undefined,
        message.metadata && Array.isArray((message.metadata as any).sources)
          ? (message.metadata as any).sources
          : undefined,
      ];

      const summarySources = candidateSources
        .flatMap((value) => normalizeSources(value))
        .filter((source, index, self) => index === self.findIndex((item) => item.url === source.url && item.title === source.title));

      const summaryText = [
        structuredSummary.content,
        structuredSummary.summary,
        structuredSummary.text,
        isParsedObject ? parsedContent.content : undefined,
        isParsedObject ? parsedContent.summary : undefined,
      ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

      const likesData = [
        structuredSummary['likes-data'],
        structuredSummary.likesData,
        isParsedObject ? parsedContent['likes-data'] : undefined,
        isParsedObject ? parsedContent.likesData : undefined,
      ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

      const contextItems = Array.from(
        new Set(
          [
            ...toStringArray(structuredSummary.context),
            ...toStringArray(structuredSummary.background),
            ...(isParsedObject ? toStringArray(parsedContent.context) : []),
            ...(isParsedObject ? toStringArray(parsedContent.background) : []),
          ],
        ),
      );

      const debateItems = Array.from(
        new Set(
          [
            ...toStringArray(structuredSummary.debate),
            ...toStringArray(structuredSummary.arguments),
            ...(isParsedObject ? toStringArray(parsedContent.debate) : []),
            ...(isParsedObject ? toStringArray(parsedContent.arguments) : []),
          ],
        ),
      );

      const personalization = [
        structuredSummary.personalization,
        isParsedObject ? parsedContent.personalization : undefined,
        typeof message.metadata?.personalization === 'string' ? message.metadata.personalization : undefined,
      ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

      const thesisText = [
        structuredSummary.thesis,
        isParsedObject ? parsedContent.thesis : undefined,
        summaryText,
      ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

      const summaryData: SummaryData = {
        topicName,
        likesData: likesData || '',
        context: contextItems,
        thesis: thesisText || '',
        debate: debateItems,
        personalization: personalization || '',
        ...(summaryWhyItMatters ? { whyItMatters: summaryWhyItMatters } : {}),
        ...(summarySources.length > 0 ? { sources: summarySources } : {}),
      };

      return (
        <div key={message.id} className="flex flex-col items-start gap-4">
          {bubbleText && <MessageBubble message={{ ...message, content: bubbleText }} />}
          <div className="w-full animate-fadeIn">
            <TopicSummary summary={summaryData} trendName={trendName} disabled={disabled} />
          </div>
          {renderButtons(buttons)}
        </div>
      );
    }

    const defaultText = [
      bubbleText,
      isParsedObject && typeof parsedContent?.content === 'string' ? parsedContent.content : undefined,
      !isParsedObject ? message.content : undefined,
    ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

    const renderedButtons = renderButtons(buttons);

    if (!defaultText && !renderedButtons) {
      return null;
    }

    return (
      <div key={message.id} className="flex flex-col items-start gap-3">
        {defaultText && <MessageBubble message={{ ...message, content: defaultText }} />}
        {renderedButtons}
      </div>
    );
  };

  const isSendDisabled = isProcessing || connectionStatus !== 'connected';

  if (isLoadingHistory) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-3" />
          <p className="text-gray-600">Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      <ConnectionStatus status={connectionStatus} onReconnect={handleReconnect} />

      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-md mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
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
      </header>

      <div className="flex-1 flex flex-col">
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="max-w-screen-md mx-auto w-full flex flex-col gap-6">
            {messages.length === 0 && !isProcessing && !error && (
              <div className="flex flex-col items-center text-center gap-4 py-16 px-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl flex items-center justify-center shadow-lg">
                  <MessageCircle className="w-10 h-10 text-blue-600" />
                </div>
                <div className="space-y-2 max-w-sm">
                  <h2 className="text-2xl font-bold text-gray-900">Welcome to WebChannel</h2>
                  <p className="text-gray-600">
                    Tap to explore the hottest trends or ask a question whenever you like.
                  </p>
                </div>
                <button
                  onClick={() => handleSendMessage('assuntos')}
                  disabled={isSendDisabled}
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  Ver assuntos do momento
                </button>
              </div>
            )}

            {messages.map((message) => {
              if (message.role === 'assistant') {
                return renderAssistantMessage(message);
              }

              return <MessageBubble key={message.id} message={message} />;
            })}

            {error && (
              <div className="flex justify-center animate-fadeIn">
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

            {isProcessing && (
              <div className="px-2">
                <TypingIndicator startTime={processingStartTime} />
              </div>
            )}
          </div>
        </div>

        <MessageInput
          onSend={handleSendMessage}
          disabled={isSendDisabled}
          placeholder={isProcessing ? 'Quenty-AI is thinking...' : connectionStatus !== 'connected' ? 'Connecting...' : 'Type a message...'}
          onFocus={scrollToBottom}
        />
      </div>
    </div>
  );
}
