import { ChevronDown, Link2, AlertCircle } from 'lucide-react';
import { TrendData, TopicData } from '../../types/tapNavigation';
import { TopicSkeleton } from './LoadingProgress';

interface TrendCardProps {
  trend: TrendData;
  isExpanded: boolean;
  topics: TopicData[] | null;
  topicsSummary?: string | null;
  isLoadingTopics: boolean;
  topicsError?: string | null;
  onExpand: () => void;
  onCollapse: () => void;
  onTopicSelect: (topic: TopicData) => void;
  onRetryTopics?: () => void;
  disabled?: boolean;
}

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
}: TrendCardProps) {
  const contentId = `trend-${trend.id}-content`;

  const handleToggle = () => {
    if (disabled) return;
    if (isExpanded) {
      onCollapse();
    } else {
      onExpand();
    }
  };

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
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm font-bold text-blue-600">#{trend.number}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-blue-600">
              <span>{trend.category}</span>
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">{trend.name}</h3>
            <p className="text-sm text-gray-600 mb-2 line-clamp-3">{trend.description}</p>

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
              {trend.value && <span className="font-medium text-gray-700">{trend.value}</span>}
              {trend.url && (
                <a
                  href={trend.url}
                  onClick={(e) => e.stopPropagation()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                  title="Abrir link em uma nova aba"
                >
                  <Link2 className="w-3 h-3" aria-hidden="true" />
                  Link
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
          {trend.whyItMatters && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg flex gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-blue-900 mb-1">Why it matters</p>
                <p className="text-xs text-blue-800">{trend.whyItMatters}</p>
              </div>
            </div>
          )}

          {isLoadingTopics ? (
            <TopicSkeleton />
          ) : topicsError && (!topics || topics.length === 0) ? (
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
          ) : (
            <div className="space-y-3">
              {topics && topics.length > 0 && (
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Tópicos ({topics.length})
                </h4>
              )}
              {topicsSummary && (
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <p className="text-xs font-semibold text-gray-900 mb-1">Panorama do Assunto</p>
                  <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{topicsSummary}</p>
                </div>
              )}
              {topicsError && topics && topics.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span>{topicsError}</span>
                </div>
              )}
              {topics && topics.length > 0 ? (
                topics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => onTopicSelect(topic)}
                    disabled={disabled}
                    type="button"
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-green-500 hover:bg-green-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-green-600">#{topic.number}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-gray-900 text-sm group-hover:text-green-700">
                        Tópico #{topic.number}
                      </h5>
                      <p className="text-xs text-gray-600 line-clamp-2 mt-1">{topic.description}</p>
                      {topic.likesData && (
                        <p className="text-xs text-gray-500 mt-2">{topic.likesData}</p>
                      )}
                    </div>
                    <ChevronDown
                      className="w-4 h-4 text-gray-400 group-hover:text-green-600 flex-shrink-0 -rotate-90"
                      aria-hidden="true"
                    />
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum tópico disponível</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
