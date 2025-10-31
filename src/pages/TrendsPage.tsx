import { useEffect, useState } from 'react';
import { supabase, DailyTrend } from '../lib/supabase';
import { TrendingUp, Calendar, ChevronRight, Loader2, ChevronLeft } from 'lucide-react';

type TrendsPageProps = {
  onSelectTrend: (trendId: string, trendName: string) => void;
};

export function TrendsPage({ onSelectTrend }: TrendsPageProps) {
  const [trends, setTrends] = useState<DailyTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [error, setError] = useState('');

  useEffect(() => {
    loadTrends();
  }, [selectedDate]);

  const loadTrends = async () => {
    try {
      setLoading(true);
      setError('');

      const dateString = selectedDate.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_trends')
        .select('*')
        .eq('date', dateString)
        .maybeSingle();

      if (error) throw error;
      setTrends(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load trends');
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Daily Trends</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => changeDate(1)}
              disabled={isToday}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next day"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-5 h-5" />
          <span className="text-sm font-medium">{formatDate(selectedDate)}</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {!trends && !loading && (
        <div className="text-center py-12">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No trends available for this date</p>
        </div>
      )}

      {trends && trends.trends_data && (
        <div className="space-y-3">
          {Array.isArray(trends.trends_data) ? (
            trends.trends_data.map((trend: any, index: number) => (
              <button
                key={trend.id || index}
                onClick={() => onSelectTrend(trend.id || `trend-${index}`, trend.name || trend.title)}
                className="w-full bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border border-gray-200 text-left group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-sm font-bold">
                        {index + 1}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {trend.name || trend.title}
                      </h3>
                    </div>
                    {trend.description && (
                      <p className="text-gray-600 text-sm line-clamp-2">{trend.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-1" />
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-gray-600">
              <p>Unable to display trends. Please check the data format.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
