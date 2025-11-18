import { FileText, ArrowLeft, Link2, AlertCircle } from 'lucide-react';
import type { SummaryData } from '../types/tapNavigation';

type TopicSummaryProps = {
  summary: SummaryData;
  trendName?: string;
  onBack?: () => void;
  disabled?: boolean;
};

export function TopicSummary({ summary, trendName, onBack, disabled = false }: TopicSummaryProps) {
  const formatSourceDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString('pt-BR');
  };

  const contextItems = Array.isArray(summary.context) ? summary.context : [];
  const debateItems = Array.isArray(summary.debate) ? summary.debate : [];
  const sources = summary.sources && summary.sources.length > 0 ? summary.sources : undefined;

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

      <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-xl p-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-gray-900 mb-1">{summary.topicName}</h3>
            {trendName && <p className="text-sm text-gray-600 mb-1">{trendName}</p>}
            {summary.likesData && (
              <p className="text-xs font-medium text-blue-700">{summary.likesData}</p>
            )}
            {(summary.thread_id || summary.comment_id) && (
              <p className="text-[11px] text-gray-500 mt-1">
                {summary.thread_id && <span>Thread ID: {summary.thread_id}</span>}
                {summary.thread_id && summary.comment_id && <span className="mx-1">•</span>}
                {summary.comment_id && <span>Comment ID: {summary.comment_id}</span>}
              </p>
            )}
          </div>
        </div>

        {contextItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Contexto</h4>
            <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
              {contextItems.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {summary.thesis && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Tese central</h4>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{summary.thesis}</p>
          </div>
        )}

        {debateItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Debate em destaque</h4>
            <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
              {debateItems.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {summary.personalization && (
          <div className="p-4 bg-blue-100/60 border border-blue-200 rounded-lg text-sm text-blue-900 leading-relaxed">
            {summary.personalization}
          </div>
        )}

        {summary.whyItMatters && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Por que importa</p>
              <p className="text-sm text-amber-800 whitespace-pre-line leading-relaxed mt-1">
                {summary.whyItMatters}
              </p>
            </div>
          </div>
        )}

        {sources && (
          <div>
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
                    <div className="mt-1 text-xs text-gray-400">
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
