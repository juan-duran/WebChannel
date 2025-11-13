import { FileText, ChevronRight, ArrowLeft } from 'lucide-react';

export type Topic = {
  id: string;
  number: number;
  name: string;
  description?: string;
  value?: string;
  likesData?: string;
};

type TopicsListProps = {
  topics: Topic[];
  trendName: string;
  onSelect: (topic: Topic) => void;
  onBack?: () => void;
  disabled?: boolean;
};

export function TopicsList({ topics, trendName, onSelect, onBack, disabled = false }: TopicsListProps) {
  return (
    <div className="space-y-3">
      {onBack && (
        <button
          onClick={onBack}
          disabled={disabled}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Assuntos
        </button>
      )}

      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Tópicos
          </h3>
          <p className="text-sm text-gray-600">{trendName}</p>
        </div>
      </div>

      <div className="grid gap-2">
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => onSelect(topic)}
            disabled={disabled}
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-sm font-bold text-green-600">
                {topic.number}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">
                {topic.name}
              </h4>
              {topic.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                  {topic.description}
                </p>
              )}
              {topic.likesData && (
                <p className="text-xs text-gray-500 mt-1">{topic.likesData}</p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
