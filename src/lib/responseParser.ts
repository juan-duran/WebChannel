import { Trend } from '../components/TrendsList';
import { Topic } from '../components/TopicsList';
import type { SummaryData, SourceData } from '../types/tapNavigation';

type TrendExtraction = {
  trends: Trend[];
  summary?: string;
  metadata?: Record<string, any>;
};

type TopicsExtraction = {
  topics: Topic[];
  summary?: string;
  metadata?: Record<string, any>;
};

type SummaryExtraction = {
  summary: SummaryData;
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

const toUniqueStringArray = (value: unknown): string[] => {
  if (value === null || value === undefined) {
    return [];
  }

  const arraySource = Array.isArray(value) ? value : [value];
  const normalized = arraySource
    .map((item) => toStringIfPresent(item))
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (normalized.length === 0) {
    return [];
  }

  return Array.from(new Set(normalized));
};

const stripOuterQuotes = (value: string): string => value.replace(/^["'“”‘’«»]+/, '').replace(/["'“”‘’«»]+$/, '');

type TopicTextMetadata = {
  text: string;
  number?: number;
  likesData?: string;
};

const extractTopicTextMetadata = (raw: string | undefined | null): TopicTextMetadata | null => {
  if (!raw) {
    return null;
  }

  let working = raw.trim();
  if (!working) {
    return null;
  }

  working = stripOuterQuotes(working).trim();
  if (!working) {
    return null;
  }

  let likesData: string | undefined;
  const likesPattern = /\(([^()]*?(?:👍|curtidas?|likes?|reaç(?:ões|oes)|engajamento)[^()]*)\)\s*$/iu;
  const likesMatch = working.match(likesPattern);
  if (likesMatch && likesMatch.index !== undefined) {
    likesData = likesMatch[1].trim();
    working = working.slice(0, likesMatch.index).trim();
  }

  let number: number | undefined;
  const topicPrefixPattern = /^(?:t[óo]pico|topic)\s*#?(?<num>\d+)\s*(?:[-–—:.)]\s*|\s+)(?<rest>.*)$/iu;
  const topicPrefixMatch = working.match(topicPrefixPattern);
  if (topicPrefixMatch?.groups) {
    const rawNumber = topicPrefixMatch.groups.num;
    if (rawNumber) {
      const parsed = parseInt(rawNumber, 10);
      if (!Number.isNaN(parsed)) {
        number = parsed;
      }
    }
    working = (topicPrefixMatch.groups.rest ?? '').trim();
  }

  const bulletPatterns: Array<{
    regex: RegExp;
    extractNumber?: (match: RegExpMatchArray) => number | undefined;
  }> = [
    { regex: /^\s*[-*•]+\s+(?<rest>.+)$/u },
    {
      regex: /^\s*\(?(?<num>\d+)\)?[.)-]\s*(?<rest>.+)$/u,
      extractNumber: (match) => {
        const rawNumber = match.groups?.num;
        if (!rawNumber) {
          return undefined;
        }
        const parsed = parseInt(rawNumber, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      },
    },
    {
      regex: /^\s*(?<num>\d+)\s*[-–—]\s*(?<rest>.+)$/u,
      extractNumber: (match) => {
        const rawNumber = match.groups?.num;
        if (!rawNumber) {
          return undefined;
        }
        const parsed = parseInt(rawNumber, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      },
    },
    {
      regex: /^#(?<num>\d+)\s+(?<rest>.+)$/u,
      extractNumber: (match) => {
        const rawNumber = match.groups?.num;
        if (!rawNumber) {
          return undefined;
        }
        const parsed = parseInt(rawNumber, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      },
    },
  ];

  for (const { regex, extractNumber } of bulletPatterns) {
    const match = working.match(regex);
    if (match?.groups?.rest) {
      if (number === undefined && extractNumber) {
        const parsed = extractNumber(match);
        if (parsed !== undefined) {
          number = parsed;
        }
      }
      working = match.groups.rest.trim();
      break;
    }
  }

  working = stripOuterQuotes(working).trim();
  if (!working) {
    return null;
  }

  return {
    text: working,
    ...(Number.isFinite(number) ? { number: number as number } : {}),
    ...(likesData ? { likesData } : {}),
  };
};

const splitTopicText = (text: string): { name: string; description?: string } => {
  const trimmed = stripOuterQuotes(text.trim());
  if (!trimmed) {
    return { name: '' };
  }

  const newlineSegments = trimmed.split(/\n+/).map((segment) => segment.trim()).filter((segment) => segment.length > 0);
  if (newlineSegments.length > 1) {
    const [first, ...rest] = newlineSegments;
    const description = rest.join(' ').trim();
    return {
      name: first,
      ...(description && description !== first ? { description } : {}),
    };
  }

  const dividerMatch = trimmed.match(/^(.+?)\s*(?:[-–—:|•]\s+)(.+)$/);
  if (dividerMatch) {
    const name = dividerMatch[1].trim();
    const description = dividerMatch[2].trim();
    return {
      name,
      ...(description && description !== name ? { description } : {}),
    };
  }

  const sentenceSegments = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (sentenceSegments.length > 1) {
    const [first, ...rest] = sentenceSegments;
    const description = rest.join(' ').trim();
    return {
      name: first,
      ...(description && description !== first ? { description } : {}),
    };
  }

  return { name: trimmed };
};

export function parseTopicText(raw: string, index = 0): Topic | null {
  const metadata = extractTopicTextMetadata(raw);
  if (!metadata) {
    return null;
  }

  const { name, description } = splitTopicText(metadata.text);

  const fallbackNumber = Number.isFinite(metadata.number) ? (metadata.number as number) : index + 1;
  const resolvedName = name && name.trim().length > 0 ? name.trim() : `Tópico #${fallbackNumber}`;
  const sanitizedDescription = description && description.trim().length > 0 && description.trim() !== resolvedName
    ? description.trim()
    : undefined;

  return {
    id: `topic_${fallbackNumber}`,
    number: fallbackNumber,
    name: resolvedName,
    ...(sanitizedDescription ? { description: sanitizedDescription } : {}),
    value: `Tópico #${fallbackNumber}`,
    ...(metadata.likesData ? { likesData: metadata.likesData } : {}),
  } satisfies Topic;
}

const parseSourceItem = (item: unknown): SourceData | null => {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) {
      return null;
    }
    return { title: trimmed, url: trimmed } satisfies SourceData;
  }

  if (!isNonNullObject(item)) {
    return null;
  }

  const urlCandidate = ['url', 'link', 'href']
    .map((key) => toStringIfPresent((item as any)[key]))
    .find((candidate): candidate is string => typeof candidate === 'string');

  if (!urlCandidate) {
    return null;
  }

  const titleCandidate = ['title', 'name', 'label']
    .map((key) => toStringIfPresent((item as any)[key]))
    .find((candidate): candidate is string => typeof candidate === 'string');

  const publishedAtCandidate = ['publishedAt', 'published_at', 'date', 'updatedAt', 'updated_at']
    .map((key) => toStringIfPresent((item as any)[key]))
    .find((candidate): candidate is string => typeof candidate === 'string');

  return {
    title: titleCandidate ?? urlCandidate,
    url: urlCandidate,
    ...(publishedAtCandidate ? { publishedAt: publishedAtCandidate } : {}),
  } satisfies SourceData;
};

const parseSources = (value: unknown): SourceData[] => {
  if (value === null || value === undefined) {
    return [];
  }

  const items = Array.isArray(value) ? value : [value];
  const collected: SourceData[] = [];

  for (const item of items) {
    const parsed = parseSourceItem(item);
    if (parsed) {
      const exists = collected.some(
        (entry) => entry.url === parsed.url && entry.title === parsed.title && entry.publishedAt === parsed.publishedAt,
      );
      if (!exists) {
        collected.push(parsed);
      }
    }
  }

  return collected;
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
  const urlCandidates = [
    (item as any).asset_short_url,
    (item as any).assetShortUrl,
    (item as any).assetShortURL,
    (item as any).asset_short_link,
    (item as any).assetShortLink,
    (item as any).asset_link,
    (item as any).assetLink,
    (item as any).short_url,
    (item as any).shortUrl,
    (item as any).url,
    (item as any).link,
    (item as any).href,
  ];

  const url = urlCandidates
    .map(toStringIfPresent)
    .find((candidate): candidate is string => typeof candidate === 'string') ?? null;

  const assetType =
    toStringIfPresent((item as any).asset_type) ?? toStringIfPresent((item as any).assetType) ?? undefined;
  const assetThumbnail =
    [
      (item as any).asset_thumbnail,
      (item as any).assetThumbnail,
      (item as any).asset_thumbnail_url,
      (item as any).assetThumbnailUrl,
      (item as any).thumbnail,
      (item as any).image,
      (item as any).preview_image,
    ]
      .map(toStringIfPresent)
      .find((candidate): candidate is string => typeof candidate === 'string');
  const assetTitle =
    toStringIfPresent((item as any).asset_title) ?? toStringIfPresent((item as any).assetTitle) ?? undefined;
  const assetDescription =
    toStringIfPresent((item as any).asset_description) ??
    toStringIfPresent((item as any).assetDescription) ??
    undefined;
  const assetEmbedHtml =
    toStringIfPresent((item as any).asset_embed_html) ??
    toStringIfPresent((item as any).assetEmbedHtml) ??
    toStringIfPresent((item as any).embed_html) ??
    undefined;
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
    ...(assetType || assetThumbnail || assetTitle || assetDescription || assetEmbedHtml || url
      ? {
          assetType,
          assetThumbnail: assetThumbnail ?? undefined,
          assetTitle,
          assetDescription,
          assetEmbedHtml,
          assetUrl: url ?? undefined,
        }
      : {}),
  };
};

const parseTopicItem = (item: unknown, index: number): Topic | null => {
  if (typeof item === 'string') {
    return parseTopicText(item, index);
  }

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

  let number =
    parseRank((item as any).number) ??
    parseRank((item as any).rank) ??
    parseRank((item as any).position) ??
    undefined;

  const nameCandidate = [
    (item as any).name,
    (item as any).title,
    (item as any).label,
    (item as any).topic,
  ]
    .map(toStringIfPresent)
    .find((candidate): candidate is string => typeof candidate === 'string');

  const descriptionCandidate = [
    (item as any).description,
    (item as any).summary,
    (item as any).text,
    (item as any).headline,
    (item as any).detail,
    (item as any).details,
    (item as any).content,
    (item as any).subtitle,
    (item as any).message,
  ]
    .map(toStringIfPresent)
    .find((candidate): candidate is string => typeof candidate === 'string');

  const nameMetadata = nameCandidate ? extractTopicTextMetadata(nameCandidate) : null;
  const descriptionMetadata = descriptionCandidate ? extractTopicTextMetadata(descriptionCandidate) : null;

  const additionalTextCandidates = [
    toStringIfPresent((item as any).text),
    toStringIfPresent((item as any).headline),
    toStringIfPresent((item as any).summary),
    toStringIfPresent((item as any).content),
    toStringIfPresent((item as any).subtitle),
    toStringIfPresent((item as any).message),
  ];

  const textMetadataCandidates: TopicTextMetadata[] = [];
  if (nameMetadata) {
    textMetadataCandidates.push(nameMetadata);
  }
  if (descriptionMetadata) {
    textMetadataCandidates.push(descriptionMetadata);
  }

  for (const candidate of additionalTextCandidates) {
    const metadata = extractTopicTextMetadata(candidate);
    if (metadata) {
      textMetadataCandidates.push(metadata);
    }
  }

  let parsedName: string | undefined;
  let parsedDescription: string | undefined;

  for (const metadata of textMetadataCandidates) {
    const { name, description } = splitTopicText(metadata.text);
    if (!parsedName && name.trim().length > 0) {
      parsedName = name.trim();
    }
    if (!parsedDescription && description && description.trim().length > 0) {
      parsedDescription = description.trim();
    }
    if (number === undefined && metadata.number !== undefined && Number.isFinite(metadata.number)) {
      number = metadata.number;
    }
  }

  let likesData =
    toStringIfPresent((item as any)['likes-data']) ??
    toStringIfPresent((item as any).likesData) ??
    toStringIfPresent((item as any).engagement) ??
    undefined;

  if (!likesData) {
    const likesFromMetadata = textMetadataCandidates.find((metadata) => metadata.likesData);
    if (likesFromMetadata?.likesData) {
      likesData = likesFromMetadata.likesData;
    }
  }

  const fallbackNumber = Number.isFinite(number) ? (number as number) : index + 1;

  let name = parsedName ?? nameMetadata?.text ?? nameCandidate ?? parsedDescription ?? descriptionMetadata?.text ?? undefined;
  let description = parsedDescription ?? descriptionMetadata?.text ?? descriptionCandidate ?? undefined;

  name = name ? stripOuterQuotes(name).trim() : `Tópico #${fallbackNumber}`;
  if (!name) {
    name = `Tópico #${fallbackNumber}`;
  }

  if (description) {
    description = stripOuterQuotes(description).trim();
    if (!description || description === name) {
      description = undefined;
    }
  }

  const value =
    toStringIfPresent((item as any).value) ??
    toStringIfPresent((item as any).command) ??
    (Number.isFinite(fallbackNumber) ? `Tópico #${fallbackNumber}` : undefined);

  return {
    id: toStringIfPresent((item as any).id) ?? `topic_${fallbackNumber}`,
    number: fallbackNumber,
    name,
    ...(description ? { description } : {}),
    ...(value ? { value } : {}),
    ...(likesData ? { likesData } : {}),
  } satisfies Topic;
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

const parseTopicsStructuredData = (value: unknown): TopicsExtraction | null => {
  if (!isNonNullObject(value)) {
    return null;
  }

  const rawTopics = Array.isArray((value as any).topics) ? ((value as any).topics as unknown[]) : undefined;
  if (!rawTopics) {
    return null;
  }

  const topics = rawTopics
    .map((item, index) => parseTopicItem(item, index))
    .filter((topic): topic is Topic => Boolean(topic));

  if (topics.length === 0) {
    return null;
  }

  const metadata: Record<string, any> = {};

  if (isNonNullObject((value as any).metadata)) {
    Object.assign(metadata, (value as any).metadata);
  }

  const layer = toStringIfPresent((value as any).layer);
  if (layer) {
    metadata.layer = layer;
  }

  const trendNameCandidate = [
    (value as any).trendName,
    (value as any).trend_name,
    metadata.trendName,
    metadata.trend_name,
  ]
    .map(toStringIfPresent)
    .find((candidate): candidate is string => typeof candidate === 'string');

  if (trendNameCandidate) {
    metadata.trendName = trendNameCandidate;
  }

  if ('trend_name' in metadata) {
    delete metadata.trend_name;
  }

  const summaryCandidate = [
    (value as any).topicsSummary,
    (value as any).topics_summary,
    (value as any).summary,
    (value as any).description,
  ]
    .map(toStringIfPresent)
    .find((candidate): candidate is string => typeof candidate === 'string');

  if (summaryCandidate) {
    metadata.topicsSummary = summaryCandidate;
  }

  const likesDataCandidate =
    toStringIfPresent((value as any)['likes-data']) ?? toStringIfPresent((value as any).likesData);
  if (likesDataCandidate) {
    metadata.likesData = likesDataCandidate;
  }

  if ('trend_name' in metadata) {
    delete metadata.trend_name;
  }

  return {
    topics,
    summary: summaryCandidate ?? undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
};

const parseSummaryStructuredData = (value: unknown): SummaryExtraction | null => {
  if (!isNonNullObject(value)) {
    return null;
  }

  const layer = toStringIfPresent((value as any).layer);
  const summarySource = isNonNullObject((value as any).summary)
    ? ((value as any).summary as Record<string, any>)
    : layer === 'summary'
    ? (value as Record<string, any>)
    : undefined;

  const candidate = summarySource ?? ((): Record<string, any> | undefined => {
    const keys = [
      'topicName',
      'topic_name',
      'thesis',
      'summary',
      'context',
      'background',
      'debate',
      'arguments',
      'personalization',
      'personalisation',
      'likesData',
      'likes-data',
      'whyItMatters',
      'why_it_matters',
    ];

    const hasSummaryFields = keys.some((key) => key in (value as Record<string, any>));
    return hasSummaryFields ? (value as Record<string, any>) : undefined;
  })();

  if (!candidate) {
    return null;
  }

  const metadata: Record<string, any> = {};

  if (isNonNullObject((value as any).metadata)) {
    Object.assign(metadata, (value as any).metadata);
  }

  if (layer) {
    metadata.layer = layer;
  }

  const trendNameCandidate =
    toStringIfPresent((value as any).trendName) ??
    toStringIfPresent((value as any).trend_name) ??
    toStringIfPresent(metadata.trendName) ??
    toStringIfPresent((metadata as any).trend_name);

  if (trendNameCandidate) {
    metadata.trendName = trendNameCandidate;
  }

  const topicName =
    toStringIfPresent((candidate as any).topicName) ?? toStringIfPresent((candidate as any).topic_name) ?? undefined;
  const likesData =
    toStringIfPresent((candidate as any)['likes-data']) ?? toStringIfPresent((candidate as any).likesData) ?? undefined;
  const threadId =
    toStringIfPresent((candidate as any).thread_id) ??
    toStringIfPresent((candidate as any).threadId) ??
    toStringIfPresent((candidate as any).thread);
  const commentId =
    toStringIfPresent((candidate as any).comment_id) ??
    toStringIfPresent((candidate as any).commentId) ??
    toStringIfPresent((candidate as any).comment);
  const thesis =
    toStringIfPresent((candidate as any).thesis) ??
    toStringIfPresent((candidate as any).summary) ??
    toStringIfPresent((candidate as any).description) ??
    topicName ??
    undefined;
  const personalization =
    toStringIfPresent((candidate as any).personalization) ??
    toStringIfPresent((candidate as any).personalisation) ??
    undefined;
  const whyItMatters =
    toStringIfPresent((candidate as any).whyItMatters) ??
    toStringIfPresent((candidate as any)['why_it_matters']) ??
    toStringIfPresent((candidate as any).why) ??
    undefined;

  const context = toUniqueStringArray((candidate as any).context ?? (candidate as any).background);
  const debate = toUniqueStringArray((candidate as any).debate ?? (candidate as any).arguments);

  const sourceCandidates = [
    (candidate as any).sources,
    (candidate as any).references,
    (candidate as any).links,
    (candidate as any).sourceList,
  ];

  const sources = sourceCandidates.reduce<SourceData[]>((acc, current) => {
    const parsed = parseSources(current);
    for (const source of parsed) {
      if (!acc.some((entry) => entry.url === source.url && entry.title === source.title && entry.publishedAt === source.publishedAt)) {
        acc.push(source);
      }
    }
    return acc;
  }, []);

  if (
    !topicName &&
    !thesis &&
    !personalization &&
    !whyItMatters &&
    !likesData &&
    context.length === 0 &&
    debate.length === 0 &&
    sources.length === 0
  ) {
    return null;
  }

  const summary: SummaryData = {
    topicName: topicName ?? thesis ?? 'Resumo',
    likesData: likesData ?? '',
    ...(threadId ? { thread_id: threadId } : {}),
    ...(commentId ? { comment_id: commentId } : {}),
    context,
    thesis: thesis ?? topicName ?? 'Resumo',
    debate,
    personalization: personalization ?? '',
    ...(sources.length > 0 ? { sources } : {}),
    ...(whyItMatters ? { whyItMatters } : {}),
  } satisfies SummaryData;

  metadata.topicName ??= summary.topicName;

  if (likesData) {
    metadata.likesData = likesData;
  }
  if (context.length > 0) {
    metadata.context = context;
  }
  if (threadId) {
    (metadata as Record<string, unknown>).thread_id = threadId;
  }
  if (commentId) {
    (metadata as Record<string, unknown>).comment_id = commentId;
  }
  if (debate.length > 0) {
    metadata.debate = debate;
  }
  if (personalization) {
    metadata.personalization = personalization;
  }
  if (whyItMatters) {
    metadata.whyItMatters = whyItMatters;
  }
  if (sources.length > 0) {
    metadata.sources = sources;
  }

  return {
    summary,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
};

const collectTextFromObject = (value: Record<string, any>): string | undefined => {
  const fields = [
    'trendsSummary',
    'topicsSummary',
    'summary',
    'thesis',
    'headline',
    'title',
    'subtitle',
    'message',
    'text',
    'content',
    'description',
    'topicName',
    'personalization',
    'whyItMatters',
    'why_it_matters',
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
   summary?: SummaryData;
  metadata?: {
    trendName?: string;
    topicName?: string;
    [key: string]: any;
  };
  structuredData?: Record<string, any> | null;
};

export function parseAgentResponse(data: unknown, context?: { trendName?: string }): ParsedResponse {
  const fallbackText = typeof data === 'string' ? data : extractResponseText(data);
  const attemptStructured = (value: unknown): ParsedResponse | null => {
    if (!value) {
      return null;
    }

    // Unwrap nested message arrays or objects
    if (isNonNullObject(value) && 'messages' in value && Array.isArray((value as any).messages)) {
      return attemptStructured((value as any).messages);
    }

    if (Array.isArray(value)) {
      let lastParsed: ParsedResponse | null = null;
      for (const item of value) {
        const parsed = attemptStructured(item);
        if (parsed) {
          // Prefer summaries when multiple items are present
          if (parsed.type === 'summary') {
            return parsed;
          }
          lastParsed = parsed;
        }
      }
      return lastParsed;
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

      const topicsResult = parseTopicsStructuredData(structuredCandidate);
      if (topicsResult) {
        const metadata = topicsResult.metadata ? { ...topicsResult.metadata } : undefined;
        const textFromStructured = isNonNullObject(structuredCandidate)
          ? collectTextFromObject(structuredCandidate as Record<string, any>)
          : undefined;
        const textFromValue = collectTextFromObject(value);
        const contentText =
          topicsResult.summary ??
          textFromStructured ??
          textFromValue ??
          '';

        return {
          type: 'topics',
          content: contentText,
          topics: topicsResult.topics,
          metadata,
        };
      }

      const summaryResult = parseSummaryStructuredData(structuredCandidate);
      if (summaryResult) {
        const metadata = summaryResult.metadata ? { ...summaryResult.metadata } : undefined;
        const contentText = summaryResult.summary.thesis || summaryResult.summary.topicName || '';

        return {
          type: 'summary',
          content: contentText,
          summary: summaryResult.summary,
          metadata,
          structuredData: isNonNullObject(structuredCandidate)
            ? (structuredCandidate as Record<string, any>)
            : { summary: summaryResult.summary },
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

    if ('topics' in value && Array.isArray((value as any).topics)) {
      const topicsResult = parseTopicsStructuredData(value);
      if (topicsResult) {
        const metadata = topicsResult.metadata ? { ...topicsResult.metadata } : undefined;
        const textFromValue = collectTextFromObject(value);
        const contentText = topicsResult.summary ?? textFromValue ?? '';

        return {
          type: 'topics',
          content: contentText,
          topics: topicsResult.topics,
          metadata,
        };
      }
    }

    if ('summary' in value && isNonNullObject((value as any).summary)) {
      const summaryResult = parseSummaryStructuredData(value);
      if (summaryResult) {
        const metadata = summaryResult.metadata ? { ...summaryResult.metadata } : undefined;
        const contentText = summaryResult.summary.thesis || summaryResult.summary.topicName || '';

        return {
          type: 'summary',
          content: contentText,
          summary: summaryResult.summary,
          metadata,
          structuredData: isNonNullObject(value)
            ? (value as Record<string, any>)
            : { summary: summaryResult.summary },
        };
      }
    }

    return null;
  };

  const structured = attemptStructured(data);
  if (structured) {
    const content = structured.type === 'text'
      ? structured.content && structured.content.trim().length > 0
        ? structured.content
        : typeof fallbackText === 'string'
        ? fallbackText
        : JSON.stringify(data, null, 2)
      : structured.content ?? '';

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

  const textFields = [
    'text',
    'message',
    'response',
    'content',
    'headline',
    'summary',
    'trendsSummary',
    'topicsSummary',
    'description',
    'topicName',
    'thesis',
    'personalization',
    'whyItMatters',
    'why_it_matters',
  ];

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
