import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { WebSocketMessage } from '../src/lib/websocket';

type WebSocketServiceInternal = {
  handleMessage: (message: WebSocketMessage) => void;
  scheduleRequestTimeout: (correlationId: string) => void;
  requestQueue: Map<string, any>;
  correlationHandlers: Map<string, Set<(message: WebSocketMessage) => void>>;
  onCorrelation: (correlationId: string, handler: (message: WebSocketMessage) => void) => void;
  setRequestTimeout: (ms: number) => void;
};

let service: WebSocketServiceInternal;

beforeEach(async () => {
  process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://example.com';
  process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'anon-key';

  const { websocketService } = await import('../src/lib/websocket');
  service = websocketService as unknown as WebSocketServiceInternal;

  service.setRequestTimeout(30);
  service.requestQueue.clear();
  service.correlationHandlers.clear();
});

afterEach(() => {
  service.setRequestTimeout(20000);
  service.requestQueue.clear();
  service.correlationHandlers.clear();
});

test('defers cleanup until a terminal correlated message is received', async () => {
  const correlationId = 'corr-test';
  const handlerInvocations: WebSocketMessage[] = [];

  const handler = (message: WebSocketMessage) => {
    handlerInvocations.push(message);
  };

  service.requestQueue.set(correlationId, {
    message: { type: 'message', correlationId },
    attempts: 0,
    maxRetries: 1,
    status: 'pending',
    expectsCorrelation: true,
    enqueueTimestamp: Date.now(),
  });

  service.onCorrelation(correlationId, handler);
  service.scheduleRequestTimeout(correlationId);

  await new Promise((resolve) => setTimeout(resolve, 20));

  service.handleMessage({
    type: 'message',
    correlationId,
    content: 'partial',
    metadata: { stage: 'stream' },
  });

  assert.equal(handlerInvocations.length, 1, 'non-terminal packet should be delivered');
  assert.equal(service.requestQueue.has(correlationId), true, 'correlation entry should persist');
  assert.equal(
    service.correlationHandlers.get(correlationId)?.has(handler),
    true,
    'correlation handler should remain registered',
  );

  await new Promise((resolve) => setTimeout(resolve, 20));

  service.handleMessage({ type: 'message_end', correlationId });

  assert.equal(handlerInvocations.length, 2, 'terminal packet should be delivered');
  assert.equal(service.requestQueue.has(correlationId), false, 'correlation entry should be cleaned up');
  assert.equal(
    service.correlationHandlers.has(correlationId),
    false,
    'correlation handlers should be removed after terminal packet',
  );
});
