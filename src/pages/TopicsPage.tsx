import { useEffect, useState } from 'react';
import { supabase, TrendTopic } from '../lib/supabase';
import { Grid3x3, ChevronRight, Loader2, ArrowLeft } from 'lucide-react';

type TopicsPageProps = {
  trendId: string | null;
  trendName: string | null;
  onSelectTopic: (topicId: string, topicName: string) => void;
  onBack: () => void;
};

export function TopicsPage({ trendId, trendName, onSelectTopic, onBack }: TopicsPageProps) {
  const [topics, setTopics] = useState<TrendTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (trendId) {
      loadTopics();
    }
  }, [trendId]);

  const loadTopics = async () => {
    if (!trendId) return;

    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('trend_topics')
        .select('*')
        .eq('trend_id', trendId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTopics(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  if (!trendId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <Grid3x3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Select a trend to view topics</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Trends</span>
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">{trendName}</h2>
        <p className="text-gray-600">Explore {topics.length} topics related to this trend</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {topics.length === 0 && !loading && (
        <div className="text-center py-12">
          <Grid3x3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No topics available for this trend</p>
        </div>
      )}

      {topics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {topics.map((topic, index) => (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic.id, topic.topic_name)}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-200 text-left group"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600 text-sm font-bold flex-shrink-0">
                  {index + 1}
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                {topic.topic_name}
              </h3>
              {topic.topic_data && topic.topic_data.summary && (
                <p className="text-gray-600 text-sm line-clamp-3">{topic.topic_data.summary}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
