import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { TapNavigationStructuredData } from '../src/types/tapNavigation';
import type { WebSocketEventHandler, WebSocketMessageType } from '../src/lib/websocket';
import type { TopicData } from '../src/types/tapNavigation';

type ListenerMap = Map<WebSocketMessageType, Set<WebSocketEventHandler>>;
type CorrelationListenerMap = Map<string, Set<WebSocketEventHandler>>;
type ReplayListenerMap = Map<string, Set<(correlationId: string) => void>>;

const env = process.env as Record<string, string | undefined>;
if (!env.VITE_SUPABASE_URL) {
  env.VITE_SUPABASE_URL = 'https://example.com';
}
if (!env.VITE_SUPABASE_ANON_KEY) {
  env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
}

const listeners: ListenerMap = new Map();
const correlationListeners: CorrelationListenerMap = new Map();
const replayListeners: ReplayListenerMap = new Map();
let correlationCounter = 0;
let lastCorrelationId: string | undefined;

const nextCorrelationId = () => {
  correlationCounter += 1;
  return `test-corr-${correlationCounter}`;
};

const emit = (type: WebSocketMessageType, message: Parameters<WebSocketEventHandler>[0]) => {
  const correlationId = (message as any)?.correlationId;
  if (correlationId && correlationListeners.has(correlationId)) {
    correlationListeners.get(correlationId)!.forEach((handler) => handler(message));
  }

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
let originalOnCorrelation: typeof import('../src/lib/websocket')['websocketService']['onCorrelation'];
let originalOffCorrelation: typeof import('../src/lib/websocket')['websocketService']['offCorrelation'];
let originalOnReplayExhausted:
  | typeof import('../src/lib/websocket')['websocketService']['onRequestReplayExhausted'];
let originalOffReplayExhausted:
  | typeof import('../src/lib/websocket')['websocketService']['offRequestReplayExhausted'];
let originalGenerateCorrelationId: typeof import('../src/lib/websocket')['websocketService']['generateCorrelationId'];
let cacheStorage: typeof import('../src/lib/cacheStorage')['cacheStorage'];
let originalCacheMethods: Partial<typeof cacheStorage>;

beforeEach(async () => {
  const serviceModule = await import('../src/lib/tapNavigationService');
  const websocketModule = await import('../src/lib/websocket');

  tapNavigationService = serviceModule.tapNavigationService;
  websocketService = websocketModule.websocketService;
  cacheStorage = (await import('../src/lib/cacheStorage')).cacheStorage;

  listeners.clear();
  correlationListeners.clear();
  replayListeners.clear();
  correlationCounter = 0;
  lastCorrelationId = undefined;

  originalOn = websocketService.on;
  originalOff = websocketService.off;
  originalSendMessage = websocketService.sendMessage;
  originalOnCorrelation = websocketService.onCorrelation;
  originalOffCorrelation = websocketService.offCorrelation;
  originalOnReplayExhausted = websocketService.onRequestReplayExhausted;
  originalOffReplayExhausted = websocketService.offRequestReplayExhausted;
  originalGenerateCorrelationId = websocketService.generateCorrelationId;
  originalCacheMethods = {
    getTopics: cacheStorage.getTopics,
    setTopics: cacheStorage.setTopics,
    isStale: cacheStorage.isStale,
    getTrends: cacheStorage.getTrends,
  };

  (websocketService as any).on = (type: WebSocketMessageType, handler: WebSocketEventHandler) => {
    addListener(type, handler);
  };
  (websocketService as any).off = (type: WebSocketMessageType, handler: WebSocketEventHandler) => {
    removeListener(type, handler);
  };
  (websocketService as any).onCorrelation = (correlationId: string, handler: WebSocketEventHandler) => {
    if (!correlationListeners.has(correlationId)) {
      correlationListeners.set(correlationId, new Set());
    }
    correlationListeners.get(correlationId)!.add(handler);
  };
  (websocketService as any).offCorrelation = (correlationId: string, handler: WebSocketEventHandler) => {
    const handlers = correlationListeners.get(correlationId);
    if (!handlers) return;

    handlers.delete(handler);

    if (handlers.size === 0) {
      correlationListeners.delete(correlationId);
    }
  };
  (websocketService as any).onRequestReplayExhausted = (
    correlationId: string,
    handler: (correlationId: string) => void,
  ) => {
    if (!replayListeners.has(correlationId)) {
      replayListeners.set(correlationId, new Set());
    }
    replayListeners.get(correlationId)!.add(handler);
  };
  (websocketService as any).offRequestReplayExhausted = (
    correlationId: string,
    handler: (correlationId: string) => void,
  ) => {
    const handlers = replayListeners.get(correlationId);
    if (!handlers) return;

    handlers.delete(handler);

    if (handlers.size === 0) {
      replayListeners.delete(correlationId);
    }
  };
  (websocketService as any).sendMessage = async (
    _content: string,
    _metadata?: any,
    options?: { correlationId?: string },
  ) => {
    lastCorrelationId = options?.correlationId;
    return options?.correlationId;
  };
  (websocketService as any).generateCorrelationId = () => nextCorrelationId();

  (cacheStorage as any).getTopics = async () => null;
  (cacheStorage as any).setTopics = async () => {};
  (cacheStorage as any).getTrends = async () => null;
  (cacheStorage as any).isStale = () => false;
});

afterEach(() => {
  (websocketService as any).on = originalOn;
  (websocketService as any).off = originalOff;
  (websocketService as any).sendMessage = originalSendMessage;
  (websocketService as any).onCorrelation = originalOnCorrelation;
  (websocketService as any).offCorrelation = originalOffCorrelation;
  (websocketService as any).onRequestReplayExhausted = originalOnReplayExhausted;
  (websocketService as any).offRequestReplayExhausted = originalOffReplayExhausted;
  (websocketService as any).generateCorrelationId = originalGenerateCorrelationId;
  Object.assign(cacheStorage, originalCacheMethods);
  listeners.clear();
  correlationListeners.clear();
  replayListeners.clear();
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

const buildTopicsData = (): TapNavigationStructuredData => ({
  layer: 'topics',
  trends: null,
  topics: [
    {
      id: 'topic-1',
      number: 1,
      description: 'Topic 1 description',
    },
  ],
  topicsSummary: null,
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

test('requestFromAgent rejects when receiving mismatched layer for the same correlation', async () => {
  const requestPromise: Promise<TapNavigationStructuredData> = (tapNavigationService as any).requestFromAgent(
    'Load trends',
    'trends',
  );

  emit('message', {
    type: 'message',
    role: 'assistant',
    correlationId: lastCorrelationId,
    structuredData: buildSummaryData(),
  } as any);

  await assert.rejects(requestPromise, (error: any) => {
    assert.equal(error.name, 'StructuredDataValidationError');
    assert.match(error.message, /camada inesperada/);
    return true;
  });
});

test('requestFromAgent rejects assistant messages without valid structured data', async () => {
  const requestPromise: Promise<TapNavigationStructuredData> = (tapNavigationService as any).requestFromAgent(
    'Load trends',
    'trends',
  );

  emit('message', {
    type: 'message',
    role: 'assistant',
    correlationId: lastCorrelationId,
  } as any);

  await assert.rejects(requestPromise, (error: any) => {
    assert.equal(error.name, 'StructuredDataValidationError');
    assert.match(error.message, /dados estruturados/);
    return true;
  });
});

test('requestFromAgent rejects assistant messages with invalid structured data shape', async () => {
  const requestPromise: Promise<TapNavigationStructuredData> = (tapNavigationService as any).requestFromAgent(
    'Load trends',
    'trends',
  );

  emit('message', {
    type: 'message',
    role: 'assistant',
    correlationId: lastCorrelationId,
    structuredData: { layer: 'trends' },
  } as any);

  await assert.rejects(requestPromise, (error: any) => {
    assert.equal(error.name, 'StructuredDataValidationError');
    assert.match(error.message, /dados estruturados/);
    return true;
  });
});

test('requestFromAgent accepts plain text summary without content type', async () => {
  (websocketService as any).sendMessage = async (
    _content: string,
    _metadata?: any,
    options?: { correlationId?: string },
  ) => {
    lastCorrelationId = options?.correlationId;
    setTimeout(() => {
      emit(
        'message',
        {
          type: 'message',
          role: 'assistant',
          correlationId: lastCorrelationId,
          content: 'Resumo simples',
        } as any,
      );
    }, 0);
    return options?.correlationId;
  };

  const result: TapNavigationStructuredData = await (tapNavigationService as any).requestFromAgent(
    'Load summary',
    'summary',
  );

  assert.equal(result.layer, 'summary');
  assert.equal(result.summary?.thesis, 'Resumo simples');
});

test('requestFromAgent rejects summary when assistant reply is discarded and logs telemetry', async () => {
  const originalConsoleError = console.error;
  const errorLogs: unknown[] = [];

  console.error = (...args: unknown[]) => {
    errorLogs.push(args);
  };

  (websocketService as any).sendMessage = async (
    _content: string,
    _metadata?: any,
    options?: { correlationId?: string },
  ) => {
    lastCorrelationId = options?.correlationId;
    setTimeout(() => {
      emit(
        'message',
        {
          type: 'message',
          role: 'assistant',
          correlationId: lastCorrelationId,
        } as any,
      );
    }, 0);
    return options?.correlationId;
  };

  try {
    await assert.rejects(
      (tapNavigationService as any).requestFromAgent('Load summary', 'summary'),
      (error: any) => {
        assert.equal(
          error.message,
          'O assistente não retornou dados estruturados para o resumo. Tente novamente.',
        );
        return true;
      },
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.ok(
    errorLogs.some((args) => JSON.stringify(args).includes('agent_reply_discarded')),
    'discarded replies should be logged for telemetry',
  );
});

test('requestFromAgent resolves when structured data is nested inside output', async () => {
  (websocketService as any).sendMessage = async (
    _content: string,
    _metadata?: any,
    options?: { correlationId?: string },
  ) => {
    lastCorrelationId = options?.correlationId;
    setTimeout(() => {
      emit(
        'message',
        {
          type: 'message',
          role: 'assistant',
          correlationId: lastCorrelationId,
          output: { structuredData: buildTrendsData() },
        } as any,
      );
    }, 0);
    return options?.correlationId;
  };

  const result: TapNavigationStructuredData = await (tapNavigationService as any).requestFromAgent(
    'Load trends',
    'trends',
  );

  assert.equal(result.layer, 'trends');
});

test('requestFromAgent resolves when output array contains structured data in snake_case', async () => {
  (websocketService as any).sendMessage = async (
    _content: string,
    _metadata?: any,
    options?: { correlationId?: string },
  ) => {
    lastCorrelationId = options?.correlationId;
    setTimeout(() => {
      emit(
        'message',
        {
          type: 'message',
          role: 'assistant',
          correlationId: lastCorrelationId,
          output: [
            {
              structured_data: buildTopicsData(),
            },
          ],
        } as any,
      );
    }, 0);
    return options?.correlationId;
  };

  const result: TapNavigationStructuredData = await (tapNavigationService as any).requestFromAgent(
    'Load topics',
    'topics',
  );

  assert.equal(result.layer, 'topics');
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

  (websocketService as any).sendMessage = async (
    _content: string,
    _metadata?: any,
    options?: { correlationId?: string },
  ) => {
    lastCorrelationId = options?.correlationId;
    setTimeout(() => {
      emit(
        'message',
        {
          type: 'message',
          role: 'assistant',
          correlationId: lastCorrelationId,
          structuredData: topicPayload,
        } as any,
      );
    }, 0);
    return options?.correlationId;
  };

  (tapNavigationService as any).lastTrends = {
    trends: [
      {
        id: 'trend-2',
        number: 2,
        topics: topicPayload.topics,
      },
    ],
    trendsSummary: 'Topic summary',
    version: 1,
  };

  const result = await tapNavigationService.fetchTopics(2);

  assert.equal(result.success, true);
  assert.equal(Array.isArray(result.data) && result.data[0]?.description, 'Topic from topic layer');
  assert.equal(result.topicsSummary, 'Topic summary');
});

test('fetchSummary returns cached summary when available', async () => {
  const originalGetSummary = (cacheStorage as any).getSummary;
  const originalIsStale = (cacheStorage as any).isStale;
  const originalRequestFromAgent = (tapNavigationService as any).requestFromAgent;
  let agentCalled = false;

  try {
    (cacheStorage as any).getSummary = async () => ({
      data: {
        summary: { thesis: 'Cached summary' },
        metadata: { foo: 'bar' },
      },
      timestamp: Date.now() - 1000,
      expiresAt: Date.now() + 1000 * 60 * 10,
    });
    (cacheStorage as any).isStale = () => false;
    (tapNavigationService as any).requestFromAgent = async () => {
      agentCalled = true;
      throw new Error('should not be called when cache is present');
    };

    const result = await tapNavigationService.fetchSummary(1, 1, 'user-1');

    assert.equal(result.success, true);
    assert.equal(result.fromCache, true);
    assert.equal(result.data?.thesis, 'Cached summary');
    assert.equal(agentCalled, false);
  } finally {
    (cacheStorage as any).getSummary = originalGetSummary;
    (cacheStorage as any).isStale = originalIsStale;
    (tapNavigationService as any).requestFromAgent = originalRequestFromAgent;
  }
});

test('fetchSummary bypasses cache on forceRefresh and persists new summary', async () => {
  const originalGetSummary = (cacheStorage as any).getSummary;
  const originalIsStale = (cacheStorage as any).isStale;
  const originalInvalidate = (tapNavigationService as any).invalidateSummaryCache;
  const originalRequestFromAgent = (tapNavigationService as any).requestFromAgent;
  const originalSetSummary = (cacheStorage as any).setSummary;

  let invalidateCalled = false;
  let agentCalled = false;
  let setSummaryCalled = false;

  try {
    (cacheStorage as any).getSummary = async () => ({
      data: {
        summary: { thesis: 'Stale summary' },
        metadata: null,
      },
      timestamp: Date.now() - 1000,
      expiresAt: Date.now() + 1000 * 60 * 10,
    });
    (cacheStorage as any).isStale = () => false;
    (tapNavigationService as any).invalidateSummaryCache = async () => {
      invalidateCalled = true;
    };
    (tapNavigationService as any).requestFromAgent = async () => {
      agentCalled = true;
      return {
        layer: 'summary',
        trends: null,
        topics: null,
        summary: { thesis: 'Fresh summary' },
        metadata: { refreshed: true },
      } as any;
    };
    (cacheStorage as any).setSummary = async () => {
      setSummaryCalled = true;
    };

    const result = await tapNavigationService.fetchSummary(1, 1, 'user-1', { forceRefresh: true });

    assert.equal(result.success, true);
    assert.equal(result.fromCache, false);
    assert.equal(result.data?.thesis, 'Fresh summary');
    assert.equal(invalidateCalled, true);
    assert.equal(agentCalled, true);
    assert.equal(setSummaryCalled, true);
  } finally {
    (cacheStorage as any).getSummary = originalGetSummary;
    (cacheStorage as any).isStale = originalIsStale;
    (tapNavigationService as any).invalidateSummaryCache = originalInvalidate;
    (tapNavigationService as any).requestFromAgent = originalRequestFromAgent;
    (cacheStorage as any).setSummary = originalSetSummary;
  }
});
