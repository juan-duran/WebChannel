import { type KeyboardEvent } from 'react';
import { TrendingUp, ExternalLink, ArrowRight } from 'lucide-react';
import type { TrendAssetMetadata } from '../types/tapNavigation';
import { TrendAssetPreview } from './tap/TrendAssetPreview';

export type Trend = TrendAssetMetadata & {
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
        <TrendingUp className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-text-primary">Assuntos Quentes</h3>
      </div>

      {summary && (
        <div className="bg-gradient-to-br from-accent-muted via-dark-secondary to-dark-secondary border border-border-accent rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-accent uppercase tracking-wide mb-2">
            Panorama do dia
          </p>
          <p className="text-text-secondary leading-relaxed whitespace-pre-line">{summary}</p>
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
          const previewTitle = trend.headline ?? trend.name;
          const previewDescription = headline ?? trend.description;

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
              className={`group relative overflow-hidden rounded-2xl border border-border-primary bg-dark-secondary p-5 transition-all hover:border-accent hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-accent-muted flex items-center justify-center">
                      <span className="text-sm font-bold text-accent">{trend.number}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-text-primary">{trend.name}</h4>
                        {categoryLabel && (
                          <span className="inline-flex items-center rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-medium text-accent">
                            {categoryLabel}
                          </span>
                        )}
                      </div>
                      {headline && (
                        <p className="text-sm text-text-secondary leading-relaxed">{headline}</p>
                      )}
                    </div>
                  </div>
                  {metricsLabel && (
                    <span className="text-xs font-semibold text-accent bg-accent-muted border border-border-accent rounded-full px-3 py-1">
                      {metricsLabel}
                    </span>
                  )}
                </div>

                <TrendAssetPreview
                  asset={trend}
                  fallbackUrl={url}
                  fallbackTitle={previewTitle}
                  fallbackDescription={previewDescription}
                />

                {whyItMatters && (
                  <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                    <div className="flex items-start gap-2">
                      <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                      <p className="text-sm text-yellow-400 leading-relaxed whitespace-pre-line">{whyItMatters}</p>
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
                      className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover"
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
