export interface DailyTrendTopic {
  number: number;
  description: string;
  "likes-data"?: string | null;
  likesData?: string | null;
  replies_total?: number | null;
  author?: string | null;
  upvotes?: string | null;
  posted_at?: string | null;
}

export interface DailyTrend {
  position: number;
  category?: string | null;
  title: string;
  snippet?: string | null;
  value?: string | null;
  upvotes?: string | null;
  comments_total?: number | null;
  comments_last_4h?: number | null;
  asset_short_url?: string | null;
  top_comment_preview?: string | null;
  posted_at?: string | null;
  last_captured_at?: string | null;
  topics?: DailyTrendTopic[] | null;
}

export interface DailyTrendsPayload {
  trendsSummary?: string | null;
  trends?: DailyTrend[];
}
