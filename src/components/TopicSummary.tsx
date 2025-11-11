import { FileText, ArrowLeft, Calendar, Link2, AlertCircle } from 'lucide-react';
import type { SourceData } from '../types/tapNavigation';

type TopicSummaryProps = {
  topicName: string;
  trendName: string;
  content: string;
  date?: string;
  onBack?: () => void;
  disabled?: boolean;
  whyItMatters?: string;
  sources?: SourceData[];
};

export function TopicSummary({
  topicName,
  trendName,
  content,
  date,
  onBack,
  disabled = false,
  whyItMatters,
  sources,
}: TopicSummaryProps) {
  const formatSourceDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          onClick={onBack}
          disabled={disabled}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 lg:hidden"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Tópicos
        </button>
      )}

      <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {topicName}
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              {trendName}
            </p>
            {date && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                {date}
              </div>
            )}
          </div>
        </div>

        <div className="prose prose-sm max-w-none">
          <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        </div>

        {whyItMatters && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Por que importa</p>
              <p className="text-sm text-amber-800 whitespace-pre-wrap leading-relaxed mt-1">{whyItMatters}</p>
            </div>
          </div>
        )}

        {sources && sources.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Fontes</h4>
            <ul className="space-y-3">
              {sources.map((source, index) => (
                <li key={`${source.url}-${index}`} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <Link2 className="w-4 h-4" />
                    {source.title || source.url}
                  </a>
                  <p className="mt-1 text-xs text-gray-500 break-words">{source.url}</p>
                  {source.publishedAt && (
                    <div className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatSourceDate(source.publishedAt)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
