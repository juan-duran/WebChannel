import { ReactNode, useMemo, useState } from 'react';
import { MessageCircle, User, Menu, X, ClipboardList, RefreshCw } from 'lucide-react';
import { PwaInstallBanner } from './PwaInstallBanner';

type LayoutProps = {
  children: ReactNode;
  currentPage: 'chat' | 'profile' | 'onboarding' | 'tap' | 'admin';
  onNavigate: (page: 'chat' | 'profile' | 'onboarding' | 'tap' | 'admin') => void;
};

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const [showMenu, setShowMenu] = useState(false);

  const navItems = useMemo(
    () => [
      { id: 'tap' as const, icon: RefreshCw, label: 'Tendências' },
      { id: 'onboarding' as const, icon: ClipboardList, label: 'Personalização' },
      { id: 'profile' as const, icon: User, label: 'Perfil' },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-brutal-yellow flex flex-col">
      <header className="bg-white border-b-[3px] border-black sticky top-0 z-40">
        <div className="max-w-screen-md w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brutal-yellow border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000000]">
                <MessageCircle className="w-6 h-6 text-black" />
              </div>
              <h1 className="text-xl font-mono font-extrabold text-black uppercase tracking-tight">QUENTY AI</h1>
            </div>

            <button
              onClick={() => setShowMenu(!showMenu)}
              className="lg:hidden w-11 h-11 flex items-center justify-center bg-black border-2 border-black text-white shadow-[2px_2px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              aria-label="Toggle menu"
            >
              {showMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <nav className="hidden lg:flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 border-2 border-black font-mono font-bold text-sm uppercase transition-all ${
                      isActive
                        ? 'bg-brutal-yellow text-black shadow-[3px_3px_0_0_#000000]'
                        : 'bg-white text-black hover:bg-gray-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_#000000]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {showMenu && (
          <div className="lg:hidden border-t-[3px] border-black bg-white">
            <nav className="px-4 py-3 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setShowMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-2 border-black font-mono font-bold text-sm uppercase transition-all ${
                      isActive
                        ? 'bg-brutal-yellow text-black shadow-[3px_3px_0_0_#000000]'
                        : 'bg-white text-black hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 min-h-0 flex flex-col px-4 sm:px-6 lg:px-8">
        <PwaInstallBanner />
        <div
          className={`flex-1 min-h-0 w-full max-w-screen-md mx-auto ${
            currentPage === 'chat'
              ? 'flex flex-col overflow-hidden'
              : 'flex flex-col overflow-y-auto'
          }`}
        >
          {children}
        </div>
      </main>

      <nav className="lg:hidden bg-white border-t-[3px] border-black sticky bottom-0">
        <div className="max-w-screen-md w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 transition-all ${
                    isActive
                      ? 'text-black'
                      : 'text-gray-400 hover:text-black'
                  }`}
                >
                  <div className={`p-1.5 border-2 ${isActive ? 'border-black bg-brutal-yellow shadow-[2px_2px_0_0_#000000]' : 'border-transparent'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-mono font-bold uppercase ${isActive ? 'text-black' : ''}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
