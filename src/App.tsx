import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import { TrendsPage } from './pages/TrendsPage';
import { TopicsPage } from './pages/TopicsPage';
import { TopicDetailPage } from './pages/TopicDetailPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { Loader2 } from 'lucide-react';

type Page = 'trends' | 'topics' | 'topic-detail' | 'profile' | 'notifications';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('trends');
  const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);
  const [selectedTrendName, setSelectedTrendName] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedTopicName, setSelectedTopicName] = useState<string | null>(null);

  const handleNavigate = (page: 'trends' | 'topics' | 'profile' | 'notifications') => {
    setCurrentPage(page);
    if (page === 'trends') {
      setSelectedTrendId(null);
      setSelectedTrendName(null);
      setSelectedTopicId(null);
      setSelectedTopicName(null);
    }
  };

  const handleSelectTrend = (trendId: string, trendName: string) => {
    setSelectedTrendId(trendId);
    setSelectedTrendName(trendName);
    setSelectedTopicId(null);
    setSelectedTopicName(null);
    setCurrentPage('topics');
  };

  const handleSelectTopic = (topicId: string, topicName: string) => {
    setSelectedTopicId(topicId);
    setSelectedTopicName(topicName);
    setCurrentPage('topic-detail');
  };

  const handleBackToTrends = () => {
    setSelectedTrendId(null);
    setSelectedTrendName(null);
    setSelectedTopicId(null);
    setSelectedTopicName(null);
    setCurrentPage('trends');
  };

  const handleBackToTopics = () => {
    setSelectedTopicId(null);
    setSelectedTopicName(null);
    setCurrentPage('topics');
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
    <Layout
      currentPage={currentPage === 'topic-detail' ? 'topics' : currentPage}
      onNavigate={handleNavigate}
    >
      {currentPage === 'trends' && (
        <TrendsPage onSelectTrend={handleSelectTrend} />
      )}
      {currentPage === 'topics' && (
        <TopicsPage
          trendId={selectedTrendId}
          trendName={selectedTrendName}
          onSelectTopic={handleSelectTopic}
          onBack={handleBackToTrends}
        />
      )}
      {currentPage === 'topic-detail' && (
        <TopicDetailPage
          topicId={selectedTopicId}
          topicName={selectedTopicName}
          onBack={handleBackToTopics}
        />
      )}
      {currentPage === 'notifications' && <NotificationsPage />}
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
