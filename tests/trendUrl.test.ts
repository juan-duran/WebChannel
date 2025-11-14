import assert from 'node:assert/strict';

import type { TapNavigationStructuredData } from '../src/types/tapNavigation';

const SHORT_URL = 'https://sho.rt/example';

process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
process.env.DEV = 'true';

const { parseAgentResponse } = await import('../src/lib/responseParser');
const { tapNavigationService } = await import('../src/lib/tapNavigationService');

const parseResult = parseAgentResponse({
  structuredData: {
    layer: 'trends',
    trends: [
      {
        id: 'trend_1',
        name: 'Trend with short url',
        asset_short_url: SHORT_URL,
      },
    ],
  },
});

assert.ok(parseResult.trends, 'Expected parseAgentResponse to return trends');
assert.equal(parseResult.trends?.[0]?.url, SHORT_URL);

const rawStructuredData: TapNavigationStructuredData = {
  layer: 'trends',
  trends: [
    {
      id: 'trend_1',
      number: 1,
      category: '',
      name: 'Trend with short url',
      description: '',
      value: '',
      url: '',
      whyItMatters: '',
      asset_short_url: SHORT_URL,
    } as any,
  ],
  trendsSummary: null,
  topicsSummary: null,
  topics: null,
  summary: null,
  metadata: null,
};

const normalized = (tapNavigationService as any).normalizeStructuredData(rawStructuredData) as TapNavigationStructuredData;

assert.ok(normalized.trends, 'Expected normalized trends array');
assert.equal(normalized.trends?.[0]?.url, SHORT_URL);

console.log('All trend URL tests passed.');
