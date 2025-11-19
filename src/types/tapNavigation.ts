export interface TrendAssetMetadata {
  assetUrl?: string | null;
  assetType?: string | null;
  assetThumbnail?: string | null;
  assetTitle?: string | null;
  assetDescription?: string | null;
  assetEmbedHtml?: string | null;
}

export interface TrendData extends TrendAssetMetadata {
  id: string;
  number: number;
  category: string;
  name: string;
  description: string;
  value: string;
  url: string;
  whyItMatters: string;
  topics?: TopicData[];
  thread_id?: string;
}

export interface TopicData {
  id: string;
  number: number;
  description: string;
  'likes-data'?: string;
  likesData?: string;
}

export interface SourceData {
  title: string;
  url: string;
  publishedAt?: string;
}

export interface SummaryData {
  'topic-name'?: string;
  topicName?: string;
  'likes-data'?: string;
  likesData?: string;
  thread_id?: string;
  comment_id?: string;
  context?: string[];
  thesis: string;
  debate?: string[];
  personalization?: string;
  sources?: SourceData[];
  'why-it-matters'?: string;
  whyItMatters?: string;
}

export interface TapNavigationStructuredData {
  layer: 'trends' | 'topics' | 'summary';
  trends: TrendData[] | null;
  topics?: Record<number, TopicData[]> | null;
  trendsSummary?: string | null;
  topicsSummary?: string | null;
  summary: SummaryData | null;
  metadata?: {
    'trend-name'?: string | null;
    'topic-name'?: string | null;
    trendName?: string | null;
    topicName?: string | null;
    topicsSummary?: string | null;
    [key: string]: unknown;
  } | null;
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
  topicsSummary: string | null;
}
