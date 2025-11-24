import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import { ChatPageWebSocket } from './pages/ChatPageWebSocket';
import { TapNavigationPage } from './pages/TapNavigationPage';
import { ProfilePage } from './pages/ProfilePage';
import { Loader2 } from 'lucide-react';
import { OnboardingPage } from './pages/OnboardingPage';

type Page = 'chat' | 'profile' | 'onboarding' | 'tap';

const CHANNEL_UI = import.meta.env.VITE_CHANNEL_UI || 'chat';
const DEFAULT_PAGE: Page = CHANNEL_UI === 'tap' ? 'tap' : 'chat';

const getPageFromPath = (): Page => {
  if (typeof window === 'undefined') return DEFAULT_PAGE;
  const path = window.location.pathname.replace(/^\/+/, '');
  if (path.startsWith('tap')) return 'tap';
  if (path.startsWith('profile')) return 'profile';
  if (path.startsWith('onboarding')) return 'onboarding';
  if (path.startsWith('chat')) return 'chat';
  return DEFAULT_PAGE;
};

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>(() => getPageFromPath());

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getPageFromPath());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    if (typeof window !== 'undefined') {
      const path = page === 'chat' ? '/' : `/${page}`;
      window.history.pushState(null, '', path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {currentPage === 'tap' && <TapNavigationPage />}
      {currentPage === 'chat' && <ChatPageWebSocket />}
      {currentPage === 'profile' && <ProfilePage />}
      {currentPage === 'onboarding' && <OnboardingPage />}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
