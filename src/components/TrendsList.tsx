import { type KeyboardEvent } from 'react';
import { TrendingUp, ExternalLink, ArrowRight } from 'lucide-react';

export type Trend = {
  id: string;
  number: number;
  name: string;
  category?: string;
  headline?: string;
  description?: string;
  value?: string;
  command?: string;
  metrics?: string;
  url?: string | null;
  whyItMatters?: string;
};

type TrendsListProps = {
  trends: Trend[];
  summary?: string;
  onSelect: (trend: Trend) => void;
  disabled?: boolean;
};

export function TrendsList({ trends, summary, onSelect, disabled = false }: TrendsListProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, trend: Trend) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(trend);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Assuntos Quentes</h3>
      </div>

      {summary && (
        <div className="bg-gradient-to-br from-blue-50 via-white to-white border border-blue-100 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-2">
            Panorama do dia
          </p>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{summary}</p>
        </div>
      )}

      <div className="grid gap-3">
        {trends.map((trend) => {
          const headline = trend.headline || trend.description;
          const categoryLabel = trend.category && trend.category.trim().length > 0 ? trend.category : undefined;
          const metricsLabel =
            trend.metrics && trend.metrics.trim().length > 0
              ? trend.metrics
              : trend.value && !/^assunto\s*#/i.test(trend.value)
              ? trend.value
              : undefined;
          const whyItMatters = trend.whyItMatters && trend.whyItMatters.trim().length > 0 ? trend.whyItMatters : undefined;
          const url = typeof trend.url === 'string' && trend.url.trim().length > 0 ? trend.url : null;

          return (
            <div
              key={trend.id}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled}
              onClick={() => {
                if (!disabled) {
                  onSelect(trend);
                }
              }}
              onKeyDown={(event) => handleKeyDown(event, trend)}
              className={`group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-blue-400 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-600">{trend.number}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-gray-900">{trend.name}</h4>
                        {categoryLabel && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {categoryLabel}
                          </span>
                        )}
                      </div>
                      {headline && (
                        <p className="text-sm text-gray-700 leading-relaxed">{headline}</p>
                      )}
                    </div>
                  </div>
                  {metricsLabel && (
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
                      {metricsLabel}
                    </span>
                  )}
                </div>

                {whyItMatters && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3">
                    <div className="flex items-start gap-2">
                      <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                      <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-line">{whyItMatters}</p>
                    </div>
                  </div>
                )}

                {url && (
                  <div className="flex justify-end">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Abrir cobertura
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
