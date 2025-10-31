import { useEffect, useState } from 'react';
import { supabase, TopicReport } from '../lib/supabase';
import { FileText, Loader2, ArrowLeft, Clock, Calendar } from 'lucide-react';

type TopicDetailPageProps = {
  topicId: string | null;
  topicName: string | null;
  onBack: () => void;
};

export function TopicDetailPage({ topicId, topicName, onBack }: TopicDetailPageProps) {
  const [report, setReport] = useState<TopicReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (topicId) {
      loadReport();
      trackReading();
    }
  }, [topicId]);

  const loadReport = async () => {
    if (!topicId) return;

    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('topic_reports')
        .select('*')
        .eq('topic_id', topicId)
        .maybeSingle();

      if (error) throw error;
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const trackReading = async () => {
    if (!topicId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('user_reading_history').insert({
        user_id: user.id,
        topic_id: topicId,
        report_id: report?.id,
      });
    } catch (err) {
      console.error('Failed to track reading:', err);
    }
  };

  if (!topicId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Select a topic to view the detailed report</p>
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
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8 pb-20">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Topics</span>
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">{topicName}</h1>

        {report && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{new Date(report.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{Math.ceil((report.report_data?.content?.length || 1000) / 200)} min read</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {!report && !loading && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 p-8">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No report available for this topic</p>
          <p className="text-sm text-gray-500">The detailed report may still be in preparation</p>
        </div>
      )}

      {report && report.report_data && (
        <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          {report.report_data.summary && (
            <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h2>
              <p className="text-gray-700 leading-relaxed">{report.report_data.summary}</p>
            </div>
          )}

          {report.report_data.content && (
            <div className="prose max-w-none">
              <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {report.report_data.content}
              </div>
            </div>
          )}

          {report.report_data.sections && Array.isArray(report.report_data.sections) && (
            <div className="space-y-6 mt-6">
              {report.report_data.sections.map((section: any, index: number) => (
                <div key={index} className="border-l-4 border-blue-600 pl-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{section.title}</h3>
                  <p className="text-gray-700 leading-relaxed">{section.content}</p>
                </div>
              ))}
            </div>
          )}

          {report.report_data.key_points && Array.isArray(report.report_data.key_points) && (
            <div className="mt-8 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Points</h3>
              <ul className="space-y-2">
                {report.report_data.key_points.map((point: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.report_data.sources && Array.isArray(report.report_data.sources) && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sources</h3>
              <div className="space-y-2">
                {report.report_data.sources.map((source: any, index: number) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 hover:text-blue-700 text-sm hover:underline"
                  >
                    {source.title || source.url}
                  </a>
                ))}
              </div>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
