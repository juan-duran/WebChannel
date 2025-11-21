import assert from 'node:assert/strict';

process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-key';

const { inferContentTypeFromStructuredData } = await import('../src/pages/ChatPageWebSocket');

authorisedContentTypeInference();

function authorisedContentTypeInference() {
  const trendsData = { layer: 'trends', trends: [{ id: 'trend_1' }] };
  assert.equal(inferContentTypeFromStructuredData(trendsData), 'trends');

  const topicsData = { topics: [{ id: 'topic_1' }] };
  assert.equal(inferContentTypeFromStructuredData(topicsData), 'topics');

  const summaryData = { summary: { title: 'Summary title' } };
  assert.equal(inferContentTypeFromStructuredData(summaryData), 'summary');

  const arrayWrappedSummary = [{ summary: { title: 'Summary title' } }];
  assert.equal(inferContentTypeFromStructuredData(arrayWrappedSummary), 'summary');

  const nestedOutputSummary = [{ output: [{ summary: { title: 'Summary title' } }] }];
  assert.equal(inferContentTypeFromStructuredData(nestedOutputSummary), 'summary');

  const unknownLayer = { layer: 'other', data: [] };
  assert.equal(inferContentTypeFromStructuredData(unknownLayer), undefined);

  const arrayPayload = [{ id: 'trend_1' }];
  assert.equal(inferContentTypeFromStructuredData(arrayPayload), undefined);

  const emptyPayload = null;
  assert.equal(inferContentTypeFromStructuredData(emptyPayload), undefined);

  console.log('All ChatPageWebSocket inference tests passed.');
}
