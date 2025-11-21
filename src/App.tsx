import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import { ChatPageWebSocket } from './pages/ChatPageWebSocket';
import { TapNavigationPage } from './pages/TapNavigationPage';
import { ProfilePage } from './pages/ProfilePage';
import { Loader2 } from 'lucide-react';
import { websocketService } from './lib/websocket';

type Page = 'chat' | 'profile';

const CHANNEL_UI = import.meta.env.VITE_CHANNEL_UI || 'chat';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('chat');

  const handleNavigate = (page: 'chat' | 'profile') => {
    setCurrentPage(page);
  };

  useEffect(() => {
    if (!user) {
      websocketService.disconnect();
      return;
    }

    let cancelled = false;
    websocketService
      .connect()
      .catch(() => {
        if (cancelled) return;
        // connection errors will surface on demand
      });

    return () => {
      cancelled = true;
      websocketService.disconnect();
    };
  }, [user]);

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

  if (CHANNEL_UI === 'tap') {
    return <TapNavigationPage />;
  }

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {currentPage === 'chat' && <ChatPageWebSocket />}
      {currentPage === 'profile' && <ProfilePage />}
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
