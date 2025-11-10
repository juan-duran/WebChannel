import { useState } from 'react';
import { ChevronDown, ThumbsUp, MessageCircle, Link2, TrendingUp, AlertCircle } from 'lucide-react';
import { TrendData, TopicData } from '../../types/tapNavigation';
import { TopicSkeleton } from './LoadingProgress';

interface TrendCardProps {
  trend: TrendData;
  isExpanded: boolean;
  topics: TopicData[] | null;
  isLoadingTopics: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onTopicSelect: (topic: TopicData) => void;
  disabled?: boolean;
}

export function TrendCard({
  trend,
  isExpanded,
  topics,
  isLoadingTopics,
  onExpand,
  onCollapse,
  onTopicSelect,
  disabled = false,
}: TrendCardProps) {
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
        onClick={handleToggle}
        disabled={disabled}
        className="w-full p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <ThumbsUp className="w-3 h-3" />
                {trend.upvotes}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {trend.comments}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {trend.threads}
              </span>
              {trend.link && (
                <a
                  href={trend.link}
                  onClick={(e) => e.stopPropagation()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                >
                  <Link2 className="w-3 h-3" />
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
            />
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gradient-to-b from-blue-50/30 to-transparent animate-fadeIn">
          {trend.whyItMatters && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg flex gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-blue-900 mb-1">Why it matters</p>
                <p className="text-xs text-blue-800">{trend.whyItMatters}</p>
              </div>
            </div>
          )}

          {isLoadingTopics ? (
            <TopicSkeleton />
          ) : topics && topics.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Topics ({topics.length})
              </h4>
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => onTopicSelect(topic)}
                  disabled={disabled}
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
                        <MessageCircle className="w-3 h-3" />
                        {topic.comments}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {topic.threads}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-green-600 flex-shrink-0 -rotate-90" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No topics available</p>
          )}
        </div>
      )}
    </div>
  );
}
