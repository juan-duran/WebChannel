import { Trend } from '../components/TrendsList';
import { Topic } from '../components/TopicsList';

export type ParsedResponse = {
  type: 'text' | 'trends' | 'topics' | 'summary';
  content: string;
  trends?: Trend[];
  topics?: Topic[];
  metadata?: {
    trendName?: string;
    topicName?: string;
  };
};

export function parseAgentResponse(text: string, context?: { trendName?: string }): ParsedResponse {
  const lines = text.split('\n').filter(line => line.trim());

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
          description: undefined
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
        description: undefined
      });
    }
  }

  if (trendMatches.length >= 5) {
    return {
      type: 'trends',
      content: text,
      trends: trendMatches.slice(0, 15),
    };
  }

  if (topicMatches.length >= 3 || (context?.trendName && topicMatches.length > 0)) {
    return {
      type: 'topics',
      content: text,
      topics: topicMatches.slice(0, 10),
      metadata: {
        trendName: context?.trendName
      }
    };
  }

  const hasSummaryKeywords = /resumo|overview|análise|contexto|detalhes|informações/i.test(text);
  if (hasSummaryKeywords && text.length > 200) {
    return {
      type: 'summary',
      content: text,
    };
  }

  return {
    type: 'text',
    content: text,
  };
}

export function extractResponseText(data: any): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data.text) {
    return data.text;
  }

  if (data.message) {
    return data.message;
  }

  if (data.response) {
    return data.response;
  }

  if (data.content) {
    return data.content;
  }

  return JSON.stringify(data, null, 2);
}
