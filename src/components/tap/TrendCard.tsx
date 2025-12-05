import { useMemo, type MouseEvent, type ReactNode } from 'react';
import { ChevronDown, Link2, AlertCircle, Clock, MessageCircle } from 'lucide-react';
import { DailyTrend, DailyTrendTopic } from '../../types/dailyTrends';
import { extractTopicEngagement } from '../../utils/topicEngagement';
import { TopicSkeleton } from './LoadingProgress';

interface TrendCardProps {
  trend: DailyTrend;
  isExpanded: boolean;
  topics: DailyTrendTopic[] | null;
  topicsSummary?: string | null;
  isLoadingTopics: boolean;
  topicsError?: string | null;
  onExpand: () => void;
  onCollapse: () => void;
  onTopicSelect: (topic: DailyTrendTopic, event: MouseEvent<HTMLButtonElement>) => void;
  onRetryTopics?: () => void;
  disabled?: boolean;
  afterContent?: ReactNode;
  renderTopicExtras?: (topic: DailyTrendTopic) => ReactNode;
}

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(date);
};

const deduplicateTopics = (topics: DailyTrendTopic[]) => {
  const seen = new Set<string>();

  return topics.filter((topic) => {
    const key = `${topic.number ?? 'unknown'}|${(topic.description ?? '').trim().toLowerCase()}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

export function TrendCard({
  trend,
  isExpanded,
  topics,
  topicsSummary,
  isLoadingTopics,
  topicsError,
  onExpand,
  onCollapse,
  onTopicSelect,
  onRetryTopics,
  disabled = false,
  afterContent,
  renderTopicExtras,
}: TrendCardProps) {
  const contentId = `trend-${trend.id ?? trend.position ?? trend.title ?? 'trend'}-content`;
  const uniqueTopics = useMemo(() => (topics ? deduplicateTopics(topics) : []), [topics]);

  const handleToggle = () => {
    if (disabled) return;
    if (isExpanded) {
      onCollapse();
    } else {
      onExpand();
    }
  };

  const engagementValue = trend.value ?? trend.upvotes ?? 'Não informado';

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-250 hover:shadow-md">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className="w-full p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-disabled={disabled || undefined}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm font-bold text-blue-700">#{trend.position}</span>
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
              {trend.category ? (
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] border border-blue-200">{trend.category}</span>
              ) : (
                <span className="text-gray-400">Categoria não informada</span>
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-base leading-tight">{trend.title}</h3>
            {trend.snippet && (
              <p
                className={`text-sm text-gray-700 ${isExpanded ? 'line-clamp-10' : 'line-clamp-5'}`}
              >
                {trend.snippet}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
              <span className="font-semibold text-gray-800">Engajamento: {engagementValue}</span>
              {typeof trend.comments_total === 'number' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                  <MessageCircle className="w-3 h-3" aria-hidden="true" />
                  Comentários: {trend.comments_total}
                </span>
              )}
              {typeof trend.comments_last_4h === 'number' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  Últ. 4h: {trend.comments_last_4h}
                </span>
              )}
              {trend.asset_short_url && (
                <a
                  href={trend.asset_short_url}
                  onClick={(e) => e.stopPropagation()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                  title="Ver matéria completa"
                >
                  <Link2 className="w-3 h-3" aria-hidden="true" />
                  Ver matéria completa
                </a>
              )}
            </div>
          </div>

          <div className="flex-shrink-0">
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-250 ${
                isExpanded ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </div>
        </div>
      </button>

      {isExpanded && (
        <div
          id={contentId}
          className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gradient-to-b from-blue-50/30 to-transparent animate-fadeIn"
        >
          <div className="space-y-3">
            {trend.asset_short_url && (
              <a
                href={trend.asset_short_url}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Link2 className="w-4 h-4" aria-hidden="true" />
                Ver conteúdo do assunto
              </a>
            )}
            {uniqueTopics.length > 0 && (
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tópicos</h4>
            )}
            {topicsSummary && (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-gray-900 mb-1">Panorama do Assunto</p>
                <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{topicsSummary}</p>
              </div>
            )}
            {isLoadingTopics ? (
              <TopicSkeleton />
            ) : topicsError && uniqueTopics.length === 0 ? (
              <div className="text-center py-6" role="alert">
                <p className="text-sm text-red-600 mb-3 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  {topicsError}
                </p>
                {onRetryTopics && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRetryTopics();
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-full hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Tentar novamente
                  </button>
                )}
              </div>
            ) : uniqueTopics.length > 0 ? (
              <div className="space-y-2">
                {uniqueTopics.map((topic) => {
                  const { likesLabel, repliesLabel } = extractTopicEngagement(topic);

                  return (
                    <button
                      key={`topic-${topic.number}`}
                      onClick={(event) => onTopicSelect(topic, event)}
                      disabled={disabled}
                      type="button"
                      className="w-full flex flex-col gap-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-green-500 hover:bg-green-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
                          <span className="inline-flex items-center justify-center rounded-full bg-green-100 px-2 py-1 text-green-700">
                            Tópico #{topic.number}
                          </span>
                        </div>
                        <ChevronDown
                          className="w-4 h-4 text-gray-400 group-hover:text-green-600 flex-shrink-0 -rotate-90"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="text-sm text-gray-700">{topic.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-900">
                          👍 {likesLabel}
                          <span className="text-gray-500 font-normal">(Likes)</span>
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-900">
                          💬 {repliesLabel}
                          <span className="text-gray-500 font-normal">(Debates do comentário)</span>
                        </span>
                      </div>
                      {topic.posted_at && (
                        <p className="text-[11px] text-gray-500">Publicado em {formatDate(topic.posted_at)}</p>
                      )}
                      {renderTopicExtras && <div className="pt-2">{renderTopicExtras(topic)}</div>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum tópico disponível</p>
            )}
            {afterContent}
          </div>
        </div>
      )}
    </div>
  );
}
