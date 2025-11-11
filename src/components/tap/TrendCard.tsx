import {
  ChevronDown,
  ThumbsUp,
  MessageCircle,
  Link2,
  TrendingUp,
  AlertCircle,
  Info,
} from 'lucide-react';
import { TrendData, TopicData } from '../../types/tapNavigation';
import { TopicSkeleton } from './LoadingProgress';

interface TrendCardProps {
  trend: TrendData;
  isExpanded: boolean;
  topics: TopicData[] | null;
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
            <span className="text-sm font-bold text-blue-600">#{trend.rank}</span>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span className="text-sm tracking-wide">{trend.title}</span>
              {trend.newComments > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  {trend.newComments} new
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{trend.summary}</p>

            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" aria-hidden="true" />
                {trend.upvotes}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" aria-hidden="true" />
                {trend.comments}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" aria-hidden="true" />
                {trend.threads}
              </span>
              {trend.link && (
                <a
                  href={trend.link}
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
            <div className="space-y-2">
              {topics && topics.length > 0 && (
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Topics ({topics.length})
                </h4>
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
                      <span className="text-xs font-bold text-green-600">#{topic.rank}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-gray-900 text-sm truncate group-hover:text-green-700">
                        {topic.title}
                      </h5>
                      {topic.summary && (
                        <p className="text-xs text-gray-600 line-clamp-1 mt-0.5">{topic.summary}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" aria-hidden="true" />
                          {topic.comments}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" aria-hidden="true" />
                          {topic.threads}
                        </span>
                      </div>
                      {topic.whyItMatters && (
                        <p className="text-xs text-green-700 mt-1 flex items-start gap-1">
                          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
                          <span className="line-clamp-2">{topic.whyItMatters}</span>
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className="w-4 h-4 text-gray-400 group-hover:text-green-600 flex-shrink-0 -rotate-90"
                      aria-hidden="true"
                    />
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No topics available</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
