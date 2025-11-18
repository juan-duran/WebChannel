import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { TapNavigationStructuredData } from '../src/types/tapNavigation';
import type { WebSocketEventHandler, WebSocketMessageType } from '../src/lib/websocket';
import type { TopicData } from '../src/types/tapNavigation';

type ListenerMap = Map<WebSocketMessageType, Set<WebSocketEventHandler>>;

const env = process.env as Record<string, string | undefined>;
if (!env.VITE_SUPABASE_URL) {
  env.VITE_SUPABASE_URL = 'https://example.com';
}
if (!env.VITE_SUPABASE_ANON_KEY) {
  env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
}

const listeners: ListenerMap = new Map();

const emit = (type: WebSocketMessageType, message: Parameters<WebSocketEventHandler>[0]) => {
  const handlers = listeners.get(type);
  if (!handlers) return;
  handlers.forEach((handler) => handler(message));
};

const addListener = (type: WebSocketMessageType, handler: WebSocketEventHandler) => {
  if (!listeners.has(type)) {
    listeners.set(type, new Set());
  }
  listeners.get(type)!.add(handler);
};

const removeListener = (type: WebSocketMessageType, handler: WebSocketEventHandler) => {
  const handlers = listeners.get(type);
  if (!handlers) {
    return;
  }
  handlers.delete(handler);
  if (handlers.size === 0) {
    listeners.delete(type);
  }
};

let tapNavigationService: typeof import('../src/lib/tapNavigationService')['tapNavigationService'];
let websocketService: typeof import('../src/lib/websocket')['websocketService'];
let originalOn: typeof import('../src/lib/websocket')['websocketService']['on'];
let originalOff: typeof import('../src/lib/websocket')['websocketService']['off'];
let originalSendMessage: typeof import('../src/lib/websocket')['websocketService']['sendMessage'];
let cacheStorage: typeof import('../src/lib/cacheStorage')['cacheStorage'];
let originalCacheMethods: Partial<typeof cacheStorage>;

beforeEach(async () => {
  const serviceModule = await import('../src/lib/tapNavigationService');
  const websocketModule = await import('../src/lib/websocket');

  tapNavigationService = serviceModule.tapNavigationService;
  websocketService = websocketModule.websocketService;
  cacheStorage = (await import('../src/lib/cacheStorage')).cacheStorage;

  listeners.clear();

  originalOn = websocketService.on;
  originalOff = websocketService.off;
  originalSendMessage = websocketService.sendMessage;
  originalCacheMethods = {
    getTopics: cacheStorage.getTopics,
    setTopics: cacheStorage.setTopics,
    isStale: cacheStorage.isStale,
  };

  (websocketService as any).on = (type: WebSocketMessageType, handler: WebSocketEventHandler) => {
    addListener(type, handler);
  };
  (websocketService as any).off = (type: WebSocketMessageType, handler: WebSocketEventHandler) => {
    removeListener(type, handler);
  };
  (websocketService as any).sendMessage = async () => {};

  (cacheStorage as any).getTopics = async () => null;
  (cacheStorage as any).setTopics = async () => {};
  (cacheStorage as any).isStale = () => false;
});

afterEach(() => {
  (websocketService as any).on = originalOn;
  (websocketService as any).off = originalOff;
  (websocketService as any).sendMessage = originalSendMessage;
  Object.assign(cacheStorage, originalCacheMethods);
  listeners.clear();
});

const buildTrendsData = (): TapNavigationStructuredData => ({
  layer: 'trends',
  trends: [
    {
      id: 'trend-1',
      number: 1,
      category: 'category',
      name: 'Trend 1',
      description: 'Description',
      value: 'Value',
      url: 'https://example.com',
      whyItMatters: 'Why it matters',
      topics: [
        {
          id: 'topic-1',
          number: 1,
          description: 'Topic description',
          likesData: 'Topic likes',
          'likes-data': 'Topic likes',
        },
      ],
    },
  ],
  trendsSummary: null,
  summary: null,
});

const buildSummaryData = (): TapNavigationStructuredData => ({
  layer: 'summary',
  trends: null,
  trendsSummary: null,
  summary: {
    'topic-name': 'Topic title',
    topicName: 'Topic title',
    thesis: 'Thesis',
  },
});

test('requestFromAgent waits for matching layer structured data', async () => {
  const requestPromise: Promise<TapNavigationStructuredData> = (tapNavigationService as any).requestFromAgent(
    'Load trends',
    'trends',
  );

  let settled = false;
  requestPromise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );

  emit('message', {
    type: 'message',
    role: 'assistant',
    structuredData: buildSummaryData(),
  } as any);

  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(settled, false, 'request should not settle when receiving mismatched layer');

  emit('message', {
    type: 'message',
    role: 'assistant',
    structuredData: buildTrendsData(),
  } as any);

  const result = await requestPromise;
  assert.equal(result.layer, 'trends');
});

test('requestFromAgent ignores assistant messages without valid structured data', async () => {
  const requestPromise: Promise<TapNavigationStructuredData> = (tapNavigationService as any).requestFromAgent(
    'Load trends',
    'trends',
  );

  let settled = false;
  requestPromise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );

  emit('message', {
    type: 'message',
    role: 'assistant',
  } as any);

  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(
    settled,
    false,
    'request should not settle when receiving assistant messages without structured data',
  );

  emit('message', {
    type: 'message',
    role: 'assistant',
    structuredData: { layer: 'trends' },
  } as any);

  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(
    settled,
    false,
    'request should not settle when receiving assistant messages with invalid structured data',
  );

  emit('message', {
    type: 'message',
    role: 'assistant',
    structuredData: buildTrendsData(),
  } as any);

  const result = await requestPromise;
  assert.equal(result.layer, 'trends');
});

test('requestFromAgent rejects when receiving an error event', async () => {
  const requestPromise: Promise<TapNavigationStructuredData> = (tapNavigationService as any).requestFromAgent(
    'Load trends',
    'trends',
  );

  emit('error', {
    type: 'error',
    error: 'Simulated error',
  } as any);

  await assert.rejects(requestPromise, (error: any) => {
    assert.equal(error.message, 'Simulated error');
    return true;
  });
});

test('fetchTopics accepts topic-layer structured data and maps it by trend', async () => {
  const topicPayload = {
    layer: 'topics',
    trends: null,
    topics: [
      {
        id: 'topic-1',
        number: 1,
        description: 'Topic from topic layer',
      },
    ] satisfies TopicData[],
    topicsSummary: 'Topic summary',
    summary: null,
    metadata: {
      trendNumber: 2,
      topicsSummary: 'Topic summary',
    },
  } satisfies TapNavigationStructuredData;

  (websocketService as any).sendMessage = async () => {
    setTimeout(() => {
      emit(
        'message',
        {
          type: 'message',
          role: 'assistant',
          structuredData: topicPayload,
        } as any,
      );
    }, 0);
  };

  const result = await tapNavigationService.fetchTopics(2);

  assert.equal(result.success, true);
  assert.equal(Array.isArray(result.data) && result.data[0]?.description, 'Topic from topic layer');
  assert.equal(result.topicsSummary, 'Topic summary');
});
