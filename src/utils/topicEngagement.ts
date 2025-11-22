import { DailyTrendTopic } from '../types/dailyTrends';

export const extractTopicEngagement = (topic?: DailyTrendTopic | null) => {
  const likesData = topic?.['likes-data'] ?? topic?.likesData ?? '';

  const likesMatch = likesData.match(/👍\s*([\d.,]+)/);
  const repliesMatch = likesData.match(/💬\s*([\d.,]+)/);

  const likesLabel = likesMatch?.[1]?.trim() || likesData.trim() || 'Não informado';

  const repliesFromLikesData = repliesMatch?.[1]?.trim();
  const repliesLabel =
    typeof topic?.replies_total === 'number'
      ? topic.replies_total.toString()
      : repliesFromLikesData || 'Sem dados';

  return {
    likesLabel,
    repliesLabel,
  };
};
