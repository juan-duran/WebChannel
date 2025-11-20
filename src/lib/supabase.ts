import { createClient } from '@supabase/supabase-js';
import { type DailyTrendsPayload } from '../types/dailyTrends';

const envSource =
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env) ||
  (typeof process !== 'undefined' ? process.env : undefined);

const supabaseUrl = envSource?.VITE_SUPABASE_URL ?? envSource?.SUPABASE_URL;
const supabaseAnonKey = envSource?.VITE_SUPABASE_ANON_KEY ?? envSource?.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type DailyTrend = {
  id: string;
  date: string;
  trends_data: any;
  created_at: string;
  updated_at: string;
};

export type TrendTopic = {
  id: string;
  trend_id: string;
  trend_name: string;
  topic_name: string;
  topic_data: any;
  created_at: string;
};

export type TopicReport = {
  id: string;
  topic_id: string;
  report_data: any;
  created_at: string;
};

export type UserPreference = {
  id: string;
  user_id: string;
  subscribed_topics: string[];
  notification_enabled: boolean;
  notification_time: string;
  created_at: string;
  updated_at: string;
};

export interface DailyTrendsRow {
  batch_ts: string;
  payload: DailyTrendsPayload;
}
