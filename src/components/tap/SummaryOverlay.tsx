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
    <div className="fixed inset-0 z-50 bg-brutal-yellow overflow-hidden flex flex-col animate-slideUp">
      {/* Header - Brutalist Style */}
      <div className="bg-black border-b-[4px] border-black text-white px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center bg-brutal-yellow border-2 border-white text-black shadow-[3px_3px_0_0_#FFFFFF] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#FFFFFF] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              aria-label="Close"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono uppercase tracking-wider text-white/70 truncate">{headerTrendName}</div>
              <h1 className="text-lg font-mono font-bold uppercase tracking-tight truncate">{headerTopicName}</h1>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs font-mono">
              {updatedLabel && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 border border-white/30">
                  <Calendar className="w-3 h-3" />
                  <span className="uppercase">{updatedLabel}</span>
                </div>
              )}
              {fromCache && (
                <span className="px-2 py-1 bg-brutal-cyan border border-black text-black text-[10px] font-bold uppercase">
                  CACHE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onRefresh}
                disabled={disabled || isRefreshing}
                className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black text-black shadow-[2px_2px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onShare}
                disabled={disabled}
                className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black text-black shadow-[2px_2px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {onSave && (
                <button
                  onClick={handleSave}
                  disabled={disabled}
                  className={`w-10 h-10 flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSaved ? 'bg-cat-fofocas text-white' : 'bg-white text-black'
                  }`}
                  aria-label={isSaved ? 'Unsave' : 'Save'}
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {summary.whyItMatters && (
            <div className="mb-6 p-4 bg-white border-[3px] border-black shadow-brutal flex gap-3">
              <div className="w-10 h-10 flex-shrink-0 bg-brutal-orange border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000000]">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-1">POR QUE IMPORTA</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{summary.whyItMatters}</p>
              </div>
            </div>
          )}

          {contentText && (
            <div className="bg-white border-[3px] border-black p-6 shadow-brutal">
              {contentText.split('\n').map((paragraph, index) => {
                const trimmed = paragraph.trim();
                if (!trimmed) return null;

                if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                  const text = trimmed.slice(2, -2);
                  return (
                    <h3 key={index} className="text-base font-mono font-bold text-black uppercase tracking-tight mt-6 mb-3 flex items-center gap-2">
                      <span className="w-2 h-6 bg-black"></span>
                      {text}
                    </h3>
                  );
                }

                if (trimmed.startsWith('- ')) {
                  return (
                    <li key={index} className="ml-4 text-gray-700 mb-2 list-none flex items-start gap-2">
                      <span className="w-2 h-2 bg-brutal-cyan border border-black mt-2 flex-shrink-0"></span>
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
            <div className="mt-6 bg-white border-[3px] border-black p-4 shadow-brutal">
              <h3 className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-4 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                FONTES
              </h3>
              <div className="space-y-3">
                {summary.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-gray-50 border-2 border-black shadow-[3px_3px_0_0_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000000] transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <ExternalLink className="w-4 h-4 text-black flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black group-hover:text-brutal-orange truncate">
                          {source.title}
                        </p>
                        {source.publishedAt && (
                          <p className="text-xs font-mono text-gray-500 mt-0.5 uppercase">
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
