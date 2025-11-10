export interface TrendData {
  id: string;
  rank: number;
  title: string;
  summary: string;
  upvotes: number;
  comments: number;
  newComments: number;
  threads: number;
  link: string;
  whyItMatters: string;
}

export interface TopicData {
  id: string;
  rank: number;
  title: string;
  summary: string;
  comments: number;
  threads: number;
  link: string;
  whyItMatters: string;
}

export interface SourceData {
  title: string;
  url: string;
  publishedAt?: string;
}

export interface SummaryData {
  topicName: string;
  trendName: string;
  content: string;
  sources?: SourceData[];
  lastUpdated: string;
  whyItMatters: string;
}

export interface TapNavigationStructuredData {
  layer: 'trends' | 'topics' | 'summary';
  trends: TrendData[] | null;
  topics: TopicData[] | null;
  summary: SummaryData | null;
  metadata?: Record<string, any> | null;
}

export interface CachedEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface TapNavigationState {
  currentLayer: 'trends' | 'topics' | 'summary';
  expandedTrendId: string | null;
  selectedTopicId: string | null;
  trends: TrendData[];
  topics: TopicData[];
  summary: SummaryData | null;
  trendName: string;
  topicName: string;
  trendRank: number;
  topicRank: number;
}
