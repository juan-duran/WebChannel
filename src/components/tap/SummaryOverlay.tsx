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
    <div className="fixed inset-0 z-50 bg-dark-primary overflow-hidden flex flex-col animate-slideUp">
      <div className="bg-gradient-to-r from-accent to-accent-hover text-dark-primary px-4 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-dark-primary/20 active:bg-dark-primary/30 transition-colors text-dark-primary"
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
                <span className="px-2 py-0.5 bg-dark-primary/20 rounded text-xs">Cached</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onRefresh}
                disabled={disabled || isRefreshing}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-dark-primary/20 active:bg-dark-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-dark-primary"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onShare}
                disabled={disabled}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-dark-primary/20 active:bg-dark-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-dark-primary"
                aria-label="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {onSave && (
                <button
                  onClick={handleSave}
                  disabled={disabled}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-dark-primary/20 active:bg-dark-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-dark-primary"
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
            <div className="mb-6 p-4 bg-gradient-to-br from-accent-muted to-accent/5 rounded-xl border border-border-accent flex gap-3">
              <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-accent mb-1">Why it matters</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{summary.whyItMatters}</p>
              </div>
            </div>
          )}

          {contentText && (
            <div className="prose prose-sm max-w-none prose-invert prose-headings:font-bold prose-headings:text-text-primary prose-p:text-text-secondary prose-p:leading-relaxed prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-text-primary prose-ul:text-text-secondary prose-ol:text-text-secondary">
              {contentText.split('\n').map((paragraph, index) => {
                const trimmed = paragraph.trim();
                if (!trimmed) return null;

                if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                  const text = trimmed.slice(2, -2);
                  return (
                    <h3 key={index} className="text-lg font-bold text-text-primary mt-6 mb-3">
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
                  <p key={index} className="mb-4 text-text-secondary leading-relaxed">
                    {trimmed}
                  </p>
                );
              })}
            </div>
          )}

          {summary.sources && summary.sources.length > 0 && (
            <div className="mt-8 p-4 bg-dark-secondary rounded-xl border border-border-primary">
              <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
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
                    className="block p-3 bg-dark-tertiary rounded-lg border border-border-primary hover:border-accent hover:bg-accent-muted transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-accent flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary group-hover:text-accent truncate">
                          {source.title}
                        </p>
                        {source.publishedAt && (
                          <p className="text-xs text-text-muted mt-0.5">
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
