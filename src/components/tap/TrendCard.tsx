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
  renderInlineCta?: ReactNode;
  hideTopics?: boolean;
  allowOverflow?: boolean;
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

const getCategoryColor = (category?: string | null) => {
  const cat = category?.toLowerCase() ?? '';
  if (cat.includes('futebol') || cat.includes('esport')) {
    return { bg: 'bg-cat-futebol', text: 'text-white', border: 'border-black' };
  }
  if (cat.includes('fofoca') || cat.includes('entret')) {
    return { bg: 'bg-cat-fofocas', text: 'text-white', border: 'border-black' };
  }
  return { bg: 'bg-cat-brasil', text: 'text-white', border: 'border-black' };
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
  renderInlineCta,
  hideTopics = false,
  allowOverflow = false,
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

  const isTopTrend = (trend.position ?? 99) <= 3;
  const categoryColors = getCategoryColor(trend.category);

  return (
    <div
      className={`
        relative
        bg-white
        border-[3px] border-black
        rounded-xl
        shadow-brutal
        transition-all duration-200
        hover:shadow-brutal-lg hover:-translate-x-0.5 hover:-translate-y-0.5
        ${allowOverflow ? 'overflow-visible' : 'overflow-hidden'}
        ${isExpanded ? 'ring-2 ring-brutal-yellow ring-offset-2 ring-offset-brutal-yellow' : ''}
      `}
    >
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
          {/* Position Badge - Square brutalist style */}
          <div className="flex-shrink-0 w-11 h-11 bg-brutal-yellow border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000000]">
            <span className="font-mono font-extrabold text-base text-black">#{trend.position}</span>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Category Tag + HOT badge inline */}
            <div className="flex flex-wrap items-center gap-2">
              {trend.category ? (
                <span className={`${categoryColors.bg} ${categoryColors.text} ${categoryColors.border} border-2 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider`}>
                  {trend.category}
                </span>
              ) : (
                <span className="bg-gray-200 text-gray-600 border-2 border-black px-2 py-0.5 text-[10px] font-mono font-bold uppercase">
                  SEM CATEGORIA
                </span>
              )}
              {isTopTrend && (
                <span className="px-2 py-0.5 bg-brutal-cyan border-2 border-black text-[10px] font-mono font-extrabold uppercase">
                  HOT
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-bold text-black text-base leading-tight tracking-tight pr-8">
              {trend.title}
            </h3>

            {/* Snippet */}
            {trend.snippet && (
              <p className={`text-sm text-gray-600 ${isExpanded ? 'line-clamp-10' : 'line-clamp-2'}`}>
                {trend.snippet}
              </p>
            )}

            {/* Simple stats row */}
            {(typeof trend.comments_total === 'number' || typeof trend.comments_last_4h === 'number') && (
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {typeof trend.comments_total === 'number' && (
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" aria-hidden="true" />
                    {trend.comments_total} comentários
                  </span>
                )}
                {typeof trend.comments_last_4h === 'number' && trend.comments_last_4h > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    +{trend.comments_last_4h} nas últimas 4h
                  </span>
                )}
              </div>
            )}

            {/* VER FONTE - Primary CTA Button */}
            {trend.asset_short_url && !isExpanded && (
              <a
                href={trend.asset_short_url}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-1 px-4 py-2 bg-black border-2 border-black text-white text-xs font-mono font-bold uppercase tracking-wide shadow-[3px_3px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <Link2 className="w-4 h-4" aria-hidden="true" />
                VER FONTE
              </a>
            )}

            {renderInlineCta && <div className="pt-2">{renderInlineCta}</div>}
          </div>

          {/* Chevron */}
          <div className="flex-shrink-0 w-9 h-9 bg-black flex items-center justify-center rounded">
            <ChevronDown
              className={`w-5 h-5 text-white transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          id={contentId}
          className="px-4 pb-4 pt-2 border-t-[3px] border-black bg-brutal-yellow/10 animate-fadeIn"
        >
          <div className="space-y-4">
            {/* CTA Button */}
            {trend.asset_short_url && (
              <a
                href={trend.asset_short_url}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 px-4 py-3 bg-black border-[3px] border-black text-white text-sm font-mono font-bold uppercase tracking-wider shadow-brutal-sm transition-all hover:bg-gray-900 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                <Link2 className="w-4 h-4" aria-hidden="true" />
                VER CONTEÚDO COMPLETO
              </a>
            )}

            {/* Topics Section */}
            {!hideTopics && uniqueTopics.length > 0 && (
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-mono font-bold text-black uppercase tracking-widest">TÓPICOS</h4>
                <div className="flex-1 h-[3px] bg-black"></div>
              </div>
            )}

            {/* Topics Summary */}
            {!hideTopics && topicsSummary && (
              <div className="border-[3px] border-black bg-white p-4 shadow-[4px_4px_0_0_#000000]">
                <p className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-2">
                  PANORAMA DO ASSUNTO
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{topicsSummary}</p>
              </div>
            )}

            {/* Topics List */}
            {!hideTopics &&
              (isLoadingTopics ? (
                <TopicSkeleton />
              ) : topicsError && uniqueTopics.length === 0 ? (
                <div className="text-center py-6 border-[3px] border-red-500 bg-red-50" role="alert">
                  <p className="text-sm text-red-600 font-mono font-bold mb-3 flex items-center justify-center gap-2">
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
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-black text-xs font-mono font-bold uppercase shadow-[2px_2px_0_0_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000000] transition-all"
                    >
                      TENTAR NOVAMENTE
                    </button>
                  )}
                </div>
              ) : uniqueTopics.length > 0 ? (
                <div className="space-y-3">
                  {uniqueTopics.map((topic, index) => {
                    const { likesLabel, repliesLabel } = extractTopicEngagement(topic);
                    const rotation = index % 2 === 0 ? 'hover:rotate-[0.5deg]' : 'hover:rotate-[-0.5deg]';

                    return (
                      <button
                        key={`topic-${topic.number}`}
                        onClick={(event) => onTopicSelect(topic, event)}
                        disabled={disabled}
                        type="button"
                        className={`
                          w-full flex flex-col gap-2 p-4
                          bg-white border-[3px] border-black
                          shadow-[4px_4px_0_0_#000000]
                          hover:shadow-[6px_6px_0_0_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5
                          ${rotation}
                          transition-all text-left
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center justify-center px-3 py-1 bg-cat-futebol border-2 border-black text-white text-xs font-mono font-bold">
                            TÓPICO #{topic.number}
                          </span>
                          <ChevronDown
                            className="w-5 h-5 text-black -rotate-90"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="text-sm text-gray-800 font-medium">{topic.description}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-brutal-yellow border-2 border-black text-black text-xs font-mono font-bold">
                            👍 {likesLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-brutal-cyan border-2 border-black text-black text-xs font-mono font-bold">
                            💬 {repliesLabel}
                          </span>
                        </div>
                        {topic.posted_at && (
                          <p className="text-[11px] font-mono text-gray-500 uppercase">
                            Publicado em {formatDate(topic.posted_at)}
                          </p>
                        )}
                        {renderTopicExtras && <div className="pt-2">{renderTopicExtras(topic)}</div>}
                      </button>
                    );
                  })}
                </div>
              ) : null)}
            {afterContent}
          </div>
        </div>
      )}
    </div>
  );
}
