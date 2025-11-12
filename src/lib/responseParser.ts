import { Trend } from '../components/TrendsList';
import { Topic } from '../components/TopicsList';

type TrendExtraction = {
  trends: Trend[];
  summary?: string;
  metadata?: Record<string, any>;
};

const isNonNullObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null;

const toStringIfPresent = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const parseTrendItem = (item: unknown, index: number): Trend | null => {
  if (!isNonNullObject(item)) {
    return null;
  }

  const parseRank = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const match = value.match(/\d+/);
      if (match) {
        const parsed = parseInt(match[0], 10);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }
    return undefined;
  };

  const number =
    parseRank((item as any).number) ??
    parseRank((item as any).rank) ??
    parseRank((item as any).position) ??
    index + 1;

  const name = [
    (item as any).name,
    (item as any).title,
    (item as any).label,
  ]
    .map(toStringIfPresent)
    .find((candidate): candidate is string => typeof candidate === 'string');

  const headline = toStringIfPresent((item as any).headline);
  const description = toStringIfPresent((item as any).description);
  const category =
    toStringIfPresent((item as any).category) ??
    toStringIfPresent((item as any).type);
  const metrics = toStringIfPresent((item as any).value) ?? toStringIfPresent((item as any).stats);
  const command =
    toStringIfPresent((item as any).command) ??
    toStringIfPresent((item as any).cta) ??
    (Number.isFinite(number) ? `Assunto #${number}` : undefined);
  const url =
    toStringIfPresent((item as any).url) ??
    toStringIfPresent((item as any).link) ??
    toStringIfPresent((item as any).href) ??
    null;
  const whyItMatters =
    toStringIfPresent((item as any).whyItMatters) ??
    toStringIfPresent((item as any).why_it_matters) ??
    toStringIfPresent((item as any).why);

  const resolvedName = name ?? headline ?? description;

  if (!resolvedName) {
    return null;
  }

  const sanitizedHeadline = headline ?? (description && description !== resolvedName ? description : undefined);
  const sanitizedDescription = description && description !== sanitizedHeadline ? description : undefined;

  return {
    id:
      toStringIfPresent((item as any).id) ??
      `trend_${Number.isFinite(number) ? number : index + 1}`,
    number: Number.isFinite(number) ? (number as number) : index + 1,
    name: resolvedName,
    category: category ?? undefined,
    headline: sanitizedHeadline,
    description: sanitizedDescription,
    value: command ?? undefined,
    command: command ?? undefined,
    metrics: metrics ?? undefined,
    url,
    whyItMatters: whyItMatters ?? undefined,
  };
};

const parseTrendsStructuredData = (value: unknown): TrendExtraction | null => {
  if (!isNonNullObject(value)) {
    return null;
  }

  const rawTrends = Array.isArray((value as any).trends) ? ((value as any).trends as unknown[]) : undefined;
  if (!rawTrends) {
    return null;
  }

  const trends = rawTrends
    .map((item, index) => parseTrendItem(item, index))
    .filter((trend): trend is Trend => Boolean(trend));

  if (trends.length === 0) {
    return null;
  }

  const summary = [
    (value as any).trendsSummary,
    (value as any).trends_summary,
    (value as any).summary,
    (value as any).description,
  ]
    .map(toStringIfPresent)
    .find((candidate): candidate is string => typeof candidate === 'string');

  const metadata: Record<string, any> = {};

  if (isNonNullObject((value as any).metadata)) {
    Object.assign(metadata, (value as any).metadata);
  }

  const layer = toStringIfPresent((value as any).layer);
  if (layer) {
    metadata.layer = layer;
  }

  if (summary) {
    metadata.trendsSummary = summary;
  }

  return {
    trends,
    summary: summary ?? undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
};

const collectTextFromObject = (value: Record<string, any>): string | undefined => {
  const fields = [
    'trendsSummary',
    'summary',
    'headline',
    'title',
    'subtitle',
    'message',
    'text',
    'content',
    'description',
  ];

  const results = fields
    .map((field) => toStringIfPresent(value[field]))
    .filter((candidate): candidate is string => typeof candidate === 'string');

  if (results.length === 0) {
    return undefined;
  }

  return Array.from(new Set(results)).join('\n');
};

const parseTextResponse = (text: string, context?: { trendName?: string }): ParsedResponse => {
  const normalizedText = text ?? '';
  const lines = normalizedText.split('\n').filter((line) => line.trim());

  const trendMatches: Trend[] = [];
  const topicMatches: Topic[] = [];

  for (const line of lines) {
    const trendMatch = line.match(/^(?:Assunto\s*)?#?(\d+)[\s:.-]*(.+?)$/i);
    if (trendMatch) {
      const number = parseInt(trendMatch[1], 10);
      const name = trendMatch[2].trim();

      if (name && !name.toLowerCase().includes('tópico')) {
        trendMatches.push({
          id: `trend_${number}`,
          number,
          name,
          description: undefined,
          category: undefined,
          headline: undefined,
          value: `Assunto #${number}`,
          command: `Assunto #${number}`,
          metrics: undefined,
          url: null,
          whyItMatters: undefined,
        });
      }
    }

    const topicMatch = line.match(/^(?:Tópico\s*)?#?(\d+)[\s:.-]*(.+?)$/i);
    if (topicMatch) {
      const number = parseInt(topicMatch[1], 10);
      const name = topicMatch[2].trim();

      topicMatches.push({
        id: `topic_${number}`,
        number,
        name,
        description: undefined,
      });
    }
  }

  if (trendMatches.length >= 5) {
    return {
      type: 'trends',
      content: normalizedText,
      trends: trendMatches.slice(0, 15),
    };
  }

  if (topicMatches.length >= 3 || (context?.trendName && topicMatches.length > 0)) {
    return {
      type: 'topics',
      content: normalizedText,
      topics: topicMatches.slice(0, 10),
      metadata: {
        trendName: context?.trendName,
      },
    };
  }

  const hasSummaryKeywords = /resumo|overview|análise|contexto|detalhes|informações/i.test(normalizedText);
  if (hasSummaryKeywords && normalizedText.length > 200) {
    return {
      type: 'summary',
      content: normalizedText,
    };
  }

  return {
    type: 'text',
    content: normalizedText,
  };
};

export type ParsedResponse = {
  type: 'text' | 'trends' | 'topics' | 'summary';
  content: string;
  trends?: Trend[];
  topics?: Topic[];
  metadata?: {
    trendName?: string;
    topicName?: string;
    [key: string]: any;
  };
};

export function parseAgentResponse(data: unknown, context?: { trendName?: string }): ParsedResponse {
  const fallbackText = typeof data === 'string' ? data : extractResponseText(data);
  const attemptStructured = (value: unknown): ParsedResponse | null => {
    if (!value) {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const parsed = attemptStructured(item);
        if (parsed) {
          return parsed;
        }
      }
      return null;
    }

    if (!isNonNullObject(value)) {
      return null;
    }

    if ('output' in value && (value as any).output) {
      const parsed = attemptStructured((value as any).output);
      if (parsed) {
        return parsed;
      }
    }

    const structuredCandidate =
      'structuredData' in value && (value as any).structuredData
        ? (value as any).structuredData
        : 'structured_data' in value && (value as any).structured_data
        ? (value as any).structured_data
        : undefined;

    if (structuredCandidate) {
      const trendsResult = parseTrendsStructuredData(structuredCandidate);
      if (trendsResult) {
        const metadata = trendsResult.metadata ? { ...trendsResult.metadata } : undefined;
        const textFromValue = collectTextFromObject(value);
        const textFromStructured = isNonNullObject(structuredCandidate)
          ? collectTextFromObject(structuredCandidate)
          : undefined;
        const contentText =
          toStringIfPresent(trendsResult.summary) ??
          textFromStructured ??
          textFromValue ??
          (typeof fallbackText === 'string' ? fallbackText : '');

        return {
          type: 'trends',
          content: contentText,
          trends: trendsResult.trends,
          metadata,
        };
      }
    }

    if ('trends' in value && Array.isArray((value as any).trends)) {
      const trendsResult = parseTrendsStructuredData(value);
      if (trendsResult) {
        const metadata = trendsResult.metadata ? { ...trendsResult.metadata } : undefined;
        const textFromValue = collectTextFromObject(value);
        const contentText =
          toStringIfPresent(trendsResult.summary) ??
          textFromValue ??
          (typeof fallbackText === 'string' ? fallbackText : '');

        return {
          type: 'trends',
          content: contentText,
          trends: trendsResult.trends,
          metadata,
        };
      }
    }

    return null;
  };

  const structured = attemptStructured(data);
  if (structured) {
    const content = structured.content && structured.content.trim().length > 0
      ? structured.content
      : typeof fallbackText === 'string'
      ? fallbackText
      : JSON.stringify(data, null, 2);

    return {
      ...structured,
      content,
    };
  }

  const safeText =
    typeof fallbackText === 'string' && fallbackText.trim().length > 0
      ? fallbackText
      : JSON.stringify(data, null, 2);

  return parseTextResponse(safeText, context);
}

export function extractResponseText(data: any): string {
  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const extracted = extractResponseText(item);
      if (extracted) {
        return extracted;
      }
    }
    return JSON.stringify(data, null, 2);
  }

  if (!isNonNullObject(data)) {
    return String(data ?? '');
  }

  if ('output' in data && (data as any).output) {
    return extractResponseText((data as any).output);
  }

  const structuredCandidate =
    'structuredData' in data && (data as any).structuredData
      ? (data as any).structuredData
      : 'structured_data' in data && (data as any).structured_data
      ? (data as any).structured_data
      : undefined;

  if (structuredCandidate) {
    const structuredText = extractResponseText(structuredCandidate);
    if (structuredText) {
      return structuredText;
    }
  }

  const textFields = ['text', 'message', 'response', 'content', 'headline', 'summary', 'trendsSummary', 'description'];

  for (const field of textFields) {
    if (field in data) {
      const candidate = toStringIfPresent((data as any)[field]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return JSON.stringify(data, null, 2);
}
