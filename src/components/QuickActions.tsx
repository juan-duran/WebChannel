import { useEffect, useRef, useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';

type QuickActionsProps = {
  onSelect: (message: string) => void;
  disabled?: boolean;
};

const suggestions = [
  {
    icon: TrendingUp,
    label: 'Assuntos Quentes',
    message: 'assuntos'
  }
];

export function QuickActions({ onSelect, disabled = false }: QuickActionsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleSelect = (message: string) => {
    onSelect(message);
    setIsMenuOpen(false);
  };

  return (
    <div className="px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <h3 className="text-sm font-medium text-gray-500 mb-3 text-center">
          Comece Aqui
        </h3>
        <div className="hidden flex-wrap justify-center gap-4 sm:flex">
          {suggestions.map(suggestion => {
            const Icon = suggestion.icon;
            return (
              <button
                key={suggestion.label}
                onClick={() => handleSelect(suggestion.message)}
                disabled={disabled}
                className="flex min-w-[160px] flex-col items-center gap-2 rounded-xl border-2 border-gray-200 bg-white p-4 transition-all hover:border-blue-500 hover:bg-blue-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-white group"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 transition-colors group-hover:bg-blue-200">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">{suggestion.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sm:hidden">
          <div className="relative mx-auto flex max-w-xs justify-center" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(prev => !prev)}
              disabled={disabled}
              aria-expanded={isMenuOpen}
              className="flex items-center gap-2 rounded-full border-2 border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
              Opções rápidas
            </button>

            {isMenuOpen && (
              <div className="absolute bottom-full mb-3 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg">
                {suggestions.map(suggestion => {
                  const Icon = suggestion.icon;
                  return (
                    <button
                      key={suggestion.label}
                      onClick={() => handleSelect(suggestion.message)}
                      disabled={disabled}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
                        <Icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <span>{suggestion.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
