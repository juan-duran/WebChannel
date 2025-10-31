import { TrendingUp, Grid3x3, Sparkles } from 'lucide-react';

type QuickActionsProps = {
  onSelect: (message: string) => void;
  disabled?: boolean;
};

const suggestions = [
  {
    icon: TrendingUp,
    label: 'Assuntos Quentes',
    message: 'Mostre os assuntos quentes de hoje'
  },
  {
    icon: Grid3x3,
    label: 'Tópicos',
    message: 'Quais tópicos estão disponíveis?'
  },
  {
    icon: Sparkles,
    label: 'Assuntos Quentíssimos do Dia',
    message: 'O que há de novo e interessante hoje?'
  }
];

export function QuickActions({ onSelect, disabled = false }: QuickActionsProps) {
  return (
    <div className="px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <h3 className="text-sm font-medium text-gray-500 mb-3 text-center">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
              <button
                key={suggestion.label}
                onClick={() => onSelect(suggestion.message)}
                disabled={disabled}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {suggestion.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
