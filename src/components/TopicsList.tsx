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
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mb-4 disabled:opacity-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Assuntos
        </button>
      )}

      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-accent" />
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            Tópicos
          </h3>
          <p className="text-sm text-text-secondary">{trendName}</p>
        </div>
      </div>

      <div className="grid gap-2">
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => onSelect(topic)}
            disabled={disabled}
            className="flex items-center gap-3 p-4 rounded-xl border border-border-primary bg-dark-secondary hover:border-accent hover:bg-accent-muted transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cat-futebol/20 flex items-center justify-center">
              <span className="text-sm font-bold text-cat-futebol">
                {topic.number}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-text-primary truncate">
                {topic.name}
              </h4>
              {topic.description && (
                <p className="text-sm text-text-secondary line-clamp-2 mt-1">
                  {topic.description}
                </p>
              )}
              {topic.likesData && (
                <p className="text-xs text-text-muted mt-1">{topic.likesData}</p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
