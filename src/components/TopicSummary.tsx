import { FileText, ArrowLeft, Calendar } from 'lucide-react';

type TopicSummaryProps = {
  topicName: string;
  trendName: string;
  content: string;
  date?: string;
  onBack?: () => void;
  disabled?: boolean;
};

export function TopicSummary({
  topicName,
  trendName,
  content,
  date,
  onBack,
  disabled = false
}: TopicSummaryProps) {
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
      </div>
    </div>
  );
}
