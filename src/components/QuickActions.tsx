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
        <h3 className="text-sm font-medium text-text-muted mb-3 text-center">
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
                className="flex min-w-[160px] flex-col items-center gap-2 rounded-xl border-2 border-border-primary bg-dark-secondary p-4 transition-all hover:border-accent hover:bg-accent-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-primary disabled:hover:bg-dark-secondary group"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted transition-colors group-hover:bg-accent/20">
                  <Icon className="h-6 w-6 text-accent" />
                </div>
                <span className="text-sm font-medium text-text-primary">{suggestion.label}</span>
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
              className="flex items-center gap-2 rounded-full border-2 border-border-primary bg-dark-secondary px-5 py-3 text-sm font-medium text-text-secondary transition-all hover:border-accent hover:bg-accent-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
              Opções rápidas
            </button>

            {isMenuOpen && (
              <div className="absolute bottom-full mb-3 w-56 rounded-2xl border border-border-primary bg-dark-elevated p-2 shadow-lg">
                {suggestions.map(suggestion => {
                  const Icon = suggestion.icon;
                  return (
                    <button
                      key={suggestion.label}
                      onClick={() => handleSelect(suggestion.message)}
                      disabled={disabled}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-muted">
                        <Icon className="h-5 w-5 text-accent" />
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
