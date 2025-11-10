import { TrendingUp, ChevronRight } from 'lucide-react';

export type Trend = {
  id: string;
  number: number;
  name: string;
  description?: string;
  value?: string;
};

type TrendsListProps = {
  trends: Trend[];
  onSelect: (trend: Trend) => void;
  disabled?: boolean;
};

export function TrendsList({ trends, onSelect, disabled = false }: TrendsListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Assuntos Quentes
        </h3>
      </div>
      <div className="grid gap-2">
        {trends.map((trend) => (
          <button
            key={trend.id}
            onClick={() => onSelect(trend)}
            disabled={disabled}
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-bold text-blue-600">
                {trend.number}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">
                {trend.name}
              </h4>
              {trend.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                  {trend.description}
                </p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
