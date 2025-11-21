import { ArrowLeft, RefreshCw, Share2, Heart, Calendar, AlertCircle, ExternalLink } from 'lucide-react';
import { SummaryData } from '../../types/tapNavigation';
import { useState } from 'react';

interface SummaryOverlayProps {
  summary: SummaryData;
  trendName?: string | null;
  lastUpdated?: string | null;
  contentOverride?: string;
  isRefreshing?: boolean;
  fromCache?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onShare: () => void;
  onSave?: () => void;
  disabled?: boolean;
}

export function SummaryOverlay({
  summary,
  isRefreshing = false,
  fromCache = false,
  trendName,
  lastUpdated,
  contentOverride,
  onClose,
  onRefresh,
  onShare,
  onSave,
  disabled = false,
}: SummaryOverlayProps) {
  const [isSaved, setIsSaved] = useState(false);
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };
  const headerTrendName = trendName ?? summary.topicName ?? summary.thesis ?? 'Resumo';
  const headerTopicName = summary.topicName ?? summary.thesis ?? 'Resumo';
  const updatedLabel = lastUpdated ? formatDate(lastUpdated) : null;
  const contentText =
    contentOverride ??
    summary.context?.join('\n\n') ??
    summary.thesis ??
    summary.debate?.join('\n\n') ??
    '';

  const handleSave = () => {
    setIsSaved(!isSaved);
    onSave?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col animate-slideUp">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors text-white hover:text-gray-900 active:text-gray-900"
              aria-label="Close"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs opacity-90 truncate">{headerTrendName}</div>
              <h1 className="text-lg font-bold truncate">{headerTopicName}</h1>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 opacity-90">
              {updatedLabel && (
                <>
                  <Calendar className="w-3 h-3" />
                  <span>Last updated {updatedLabel}</span>
                </>
              )}
              {fromCache && (
                <span className="px-2 py-0.5 bg-white/20 rounded text-xs">Cached</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onRefresh}
                disabled={disabled || isRefreshing}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white hover:text-gray-900 active:text-gray-900"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onShare}
                disabled={disabled}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white hover:text-gray-900 active:text-gray-900"
                aria-label="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {onSave && (
                <button
                  onClick={handleSave}
                  disabled={disabled}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white hover:text-gray-900 active:text-gray-900"
                  aria-label={isSaved ? 'Unsave' : 'Save'}
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {summary.whyItMatters && (
            <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-blue-900 mb-1">Why it matters</h3>
                <p className="text-sm text-blue-800 leading-relaxed">{summary.whyItMatters}</p>
              </div>
            </div>
          )}

          {contentText && (
            <div className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700">
              {contentText.split('\n').map((paragraph, index) => {
                const trimmed = paragraph.trim();
                if (!trimmed) return null;

                if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                  const text = trimmed.slice(2, -2);
                  return (
                    <h3 key={index} className="text-lg font-bold text-gray-900 mt-6 mb-3">
                      {text}
                    </h3>
                  );
                }

                if (trimmed.startsWith('- ')) {
                  return (
                    <li key={index} className="ml-4">
                      {trimmed.slice(2)}
                    </li>
                  );
                }

                return (
                  <p key={index} className="mb-4 text-gray-700 leading-relaxed">
                    {trimmed}
                  </p>
                );
              })}
            </div>
          )}

          {summary.sources && summary.sources.length > 0 && (
            <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Sources
              </h3>
              <div className="space-y-2">
                {summary.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 truncate">
                          {source.title}
                        </p>
                        {source.publishedAt && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDate(source.publishedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
