import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import { ChatPageWebSocket } from './pages/ChatPageWebSocket';
import { TapNavigationPage } from './pages/TapNavigationPage';
import { ProfilePage } from './pages/ProfilePage';
import { Loader2 } from 'lucide-react';
import { OnboardingPage } from './pages/OnboardingPage';
import { useOnboardingStatus } from './state/OnboardingStatusContext';
import { AdminToolsPage } from './pages/AdminToolsPage';
import { useCurrentUser } from './state/UserContext';
import { getTrialState } from './utils/trial';
import { TrialBanner } from './components/TrialBanner';
import { TrialExpiredOverlay } from './components/TrialExpiredOverlay';
import { trackPageView } from './lib/analytics';

type Page = 'chat' | 'profile' | 'onboarding' | 'tap' | 'admin';

const CHANNEL_UI = import.meta.env.VITE_CHANNEL_UI || 'chat';
const DEFAULT_PAGE: Page = CHANNEL_UI === 'tap' ? 'tap' : 'chat';

const LEGACY_AUTH_PATH = 'legacy-auth';

const getNavigationStateFromPath = (): { page: Page; isLegacyAuth: boolean } => {
  if (typeof window === 'undefined') return { page: DEFAULT_PAGE, isLegacyAuth: false };
  const path = window.location.pathname.replace(/^\/+/, '');
  if (path.startsWith(LEGACY_AUTH_PATH)) {
    return { page: DEFAULT_PAGE, isLegacyAuth: true };
  }
  if (path.startsWith('tap')) return { page: 'tap', isLegacyAuth: false };
  if (path.startsWith('profile')) return { page: 'profile', isLegacyAuth: false };
  if (path.startsWith('onboarding')) return { page: 'onboarding', isLegacyAuth: false };
  if (path.startsWith('chat')) return { page: 'chat', isLegacyAuth: false };
  if (path.startsWith('admin-tools')) return { page: 'admin', isLegacyAuth: false };
  return { page: DEFAULT_PAGE, isLegacyAuth: false };
};

const pageToPath = (page: Page) => (page === 'chat' ? '/' : `/${page}`);

function AppContent() {
  const { loading } = useAuth();
  const onboardingStatus = useOnboardingStatus();
  const user = useCurrentUser();
  const trialState = getTrialState(user);
  const [{ currentPage, isLegacyAuth }, setNavigationState] = useState<{
    currentPage: Page;
    isLegacyAuth: boolean;
  }>(() => {
    const state = getNavigationStateFromPath();
    return {
      currentPage: state.page,
      isLegacyAuth: state.isLegacyAuth,
    };
  });

  useEffect(() => {
    const handlePopState = () => {
      const state = getNavigationStateFromPath();
      setNavigationState({
        currentPage: state.page,
        isLegacyAuth: state.isLegacyAuth,
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    trackPageView(pageToPath(currentPage));
  }, [currentPage]);

  const handleNavigate = (page: Page) => {
    setNavigationState({ currentPage: page, isLegacyAuth: false });
    if (typeof window !== 'undefined') {
      const path = pageToPath(page);
      window.history.pushState(null, '', path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (isLegacyAuth) {
    return <AuthForm />;
  }

  if (!onboardingStatus.loading && !onboardingStatus.complete && currentPage === 'chat') {
    // Redirect legacy root to onboarding/personalização if incomplete
    handleNavigate('onboarding');
    return null;
  }

  return (
    <>
      <TrialBanner trialState={trialState} />
      <TrialExpiredOverlay trialState={trialState} />
      <Layout currentPage={currentPage} onNavigate={handleNavigate}>
        {currentPage === 'tap' && <TapNavigationPage />}
        {currentPage === 'chat' && <ChatPageWebSocket />}
        {currentPage === 'profile' && <ProfilePage />}
        {currentPage === 'onboarding' && <OnboardingPage />}
        {currentPage === 'admin' && <AdminToolsPage />}
      </Layout>
    </>
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
