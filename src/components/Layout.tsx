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

  const handleLogout = () => {
    window.location.href = '/logout';
  };

  const navItems = useMemo(
    () => [
      { id: 'tap' as const, icon: RefreshCw, label: 'Tendências' },
      { id: 'onboarding' as const, icon: ClipboardList, label: 'Personalização' },
      { id: 'profile' as const, icon: User, label: 'Perfil' },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-screen-md w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">QUENTY AI</h1>
            </div>

            <button
              onClick={() => setShowMenu(!showMenu)}
              className="lg:hidden min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-gray-100 active:bg-gray-200"
              aria-label="Toggle menu"
            >
              {showMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      currentPage === item.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {showMenu && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <nav className="px-4 py-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setShowMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      currentPage === item.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
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

      <nav className="lg:hidden bg-white border-t border-gray-200 sticky bottom-0">
        <div className="max-w-screen-md w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                    currentPage === item.id
                      ? 'text-blue-600'
                      : 'text-gray-500'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
