import assert from 'node:assert/strict';

process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://example.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'anon-key';
process.env.N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL ?? 'https://example.com/webhook';
process.env.N8N_API_KEY = process.env.N8N_API_KEY ?? 'test-api-key';
process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? 'admin-key';

const { WebSocketService } = await import('../src/services/websocket.js');
await import('../src/utils/crypto.js');

type Spy<T extends (...args: any[]) => any> = T & {
  calls: any[][];
  impl?: (...args: Parameters<T>) => ReturnType<T>;
  mockImplementation: (impl: (...args: Parameters<T>) => ReturnType<T>) => void;
  mockClear: () => void;
};

function createSpy<T extends (...args: any[]) => any>(
  impl?: (...args: Parameters<T>) => ReturnType<T>
): Spy<T> {
  let implementation = impl;

  const spyFn: any = (...args: any[]) => {
    spyFn.calls.push(args);
    if (implementation) {
      return implementation(...args);
    }
    return undefined;
  };

  spyFn.calls = [] as any[][];
  spyFn.mockImplementation = (newImpl: (...args: Parameters<T>) => ReturnType<T>) => {
    implementation = newImpl;
  };
  spyFn.mockClear = () => {
    spyFn.calls = [];
  };

  return spyFn as Spy<T>;
}

const recordedMessages: any[] = [];
const sessionSendSpy = createSpy<(payload: string) => void>((payload) => {
  recordedMessages.push(JSON.parse(payload));
});

const session = {
  sessionId: 'session-1',
  userId: 'user-1',
  userEmail: 'user@example.com',
  ws: { send: (payload: string) => sessionSendSpy(payload) },
};

const sessionManagerMock = {
  getSession: createSpy<(sessionId: string) => typeof session>(() => session),
  getSessionsByUserId: createSpy<(userId: string) => Array<typeof session>>(() => [session]),
  createSession: createSpy<any>(),
  updateHeartbeat: createSpy<any>(),
  removeSession: createSpy<any>(),
};

const supabaseServiceMock = {
  logAuditMessage: createSpy<(
    userId: string,
    direction: 'in' | 'out',
    payload: Record<string, any>
  ) => Promise<void>>(async () => undefined),
  getOrCreateDefaultChannel: createSpy<(userId: string) => Promise<string | null>>(async () => 'channel-123'),
  saveMessage: createSpy<(
    channelId: string,
    userId: string | null,
    role: 'user' | 'assistant',
    content: string,
    contentType?: string,
    structuredData?: any,
    metadata?: any,
    webhookResponse?: any,
    mediaUrl?: string,
    mediaType?: string,
    mediaCaption?: string,
    correlationId?: string
  ) => Promise<string | null>>(async () => 'message-id'),
};

const n8nServiceMock = {
  sendMessage: createSpy<(
    userEmail: string,
    content: string,
    sessionId: string,
    correlationId: string,
    userId: string
  ) => Promise<any>>(async () => null),
};

const userRateLimiterMock = {
  check: createSpy<(userId: string) => boolean>(() => true),
};

function resetMocks() {
  recordedMessages.length = 0;
  sessionSendSpy.mockClear();
  sessionManagerMock.getSession.mockClear();
  sessionManagerMock.getSessionsByUserId.mockClear();
  sessionManagerMock.getSession.mockImplementation(() => session);
  sessionManagerMock.getSessionsByUserId.mockImplementation(() => [session]);
  supabaseServiceMock.logAuditMessage.mockClear();
  supabaseServiceMock.getOrCreateDefaultChannel.mockClear();
  supabaseServiceMock.saveMessage.mockClear();
  n8nServiceMock.sendMessage.mockClear();
  n8nServiceMock.sendMessage.mockImplementation(async () => null);
  userRateLimiterMock.check.mockClear();
  userRateLimiterMock.check.mockImplementation(() => true);
}

function createService() {
  const wssMock = { on: () => {} } as any;
  return new WebSocketService(wssMock, {
    sessionManager: sessionManagerMock as any,
    supabaseService: supabaseServiceMock as any,
    n8nService: n8nServiceMock as any,
    userRateLimiter: userRateLimiterMock as any,
  });
}

async function testAsyncFlow() {
  resetMocks();
  const service = createService();

  await (service as any).handleChatMessage('session-1', 'user-1', 'user@example.com', {
    type: 'message',
    content: 'hello there',
  });

  assert.equal(userRateLimiterMock.check.calls.length, 1);
  assert.equal(n8nServiceMock.sendMessage.calls.length, 1);
  assert.equal(recordedMessages.length, 2);
  assert.deepEqual(recordedMessages[0], {
    type: 'typing_start',
    message: 'Quenty-AI is thinking...',
  });
  assert.deepEqual(recordedMessages[1], {
    type: 'typing_stop',
  });
  assert.equal(supabaseServiceMock.saveMessage.calls.length, 1);
  assert.equal(supabaseServiceMock.logAuditMessage.calls.length, 2);
  assert.equal(supabaseServiceMock.logAuditMessage.calls[1][2].response, 'n8n workflow triggered');
}

async function testCachedFlow() {
  resetMocks();
  n8nServiceMock.sendMessage.mockImplementation(async () => ({
    content: 'cached reply',
    contentType: 'text',
    metadata: { cached: true },
    buttons: [{ label: 'Go', value: 'go' }],
    cacheTag: 'trends:today',
  }));

  const service = createService();

  await (service as any).handleChatMessage('session-1', 'user-1', 'user@example.com', {
    type: 'message',
    content: 'assuntos',
  });

  assert.equal(recordedMessages.length, 3);
  const assistantMessage = recordedMessages[2];
  assert.equal(assistantMessage.type, 'message');
  assert.equal(assistantMessage.role, 'assistant');
  assert.equal(assistantMessage.content, 'cached reply');
  assert.equal(assistantMessage.contentType, 'text');
  assert.deepEqual(assistantMessage.buttons, [{ label: 'Go', value: 'go' }]);
  assert.equal(assistantMessage.cacheTag, 'trends:today');
  assert.equal(typeof assistantMessage.correlationId, 'string');
  const correlationId = assistantMessage.correlationId;

  assert.equal(supabaseServiceMock.saveMessage.calls.length, 2);
  const assistantSave = supabaseServiceMock.saveMessage.calls[1];
  assert.equal(assistantSave[2], 'assistant');
  assert.equal(assistantSave[3], 'cached reply');
  assert.equal(assistantSave[11], correlationId);

  assert.equal(supabaseServiceMock.logAuditMessage.calls.length, 2);
  const auditEntry = supabaseServiceMock.logAuditMessage.calls[1][2];
  assert.equal(auditEntry.response, 'cached reply');
  assert.equal(auditEntry.delivery, 'immediate');
  assert.equal(auditEntry.correlationId, correlationId);
}

async function testNestedOutputFlow() {
  resetMocks();
  n8nServiceMock.sendMessage.mockImplementation(async () => [
    {
      output: [
        {
          data: {
            structuredData: { summary: 'Nested structured summary' },
            metadata: { nested: true },
            cacheTag: 'nested-cache',
            webhookResponse: { status: 'ok' },
            media: {
              url: 'https://example.com/image.png',
              type: 'image/png',
              caption: 'Example image',
            },
            buttons: [{ label: 'Nested CTA', value: 'nested-action' }],
            correlationId: 'nested-correlation-id',
            contentType: 'trends',
          },
        },
      ],
    },
  ]);

  const service = createService();

  await (service as any).handleChatMessage('session-1', 'user-1', 'user@example.com', {
    type: 'message',
    content: 'nested please',
  });

  assert.equal(recordedMessages.length, 3);
  const assistantMessage = recordedMessages[2];
  assert.equal(assistantMessage.type, 'message');
  assert.equal(assistantMessage.role, 'assistant');
  assert.equal(assistantMessage.content, 'Nested structured summary');
  assert.equal(assistantMessage.contentType, 'trends');
  assert.deepEqual(assistantMessage.structuredData, { summary: 'Nested structured summary' });
  assert.deepEqual(assistantMessage.metadata, { nested: true });
  assert.equal(assistantMessage.cacheTag, 'nested-cache');
  assert.deepEqual(assistantMessage.webhookResponse, { status: 'ok' });
  assert.equal(assistantMessage.mediaUrl, 'https://example.com/image.png');
  assert.equal(assistantMessage.mediaType, 'image/png');
  assert.equal(assistantMessage.mediaCaption, 'Example image');
  assert.deepEqual(assistantMessage.buttons, [{ label: 'Nested CTA', value: 'nested-action' }]);
  assert.equal(assistantMessage.correlationId, 'nested-correlation-id');

  assert.equal(supabaseServiceMock.saveMessage.calls.length, 2);
  const assistantSave = supabaseServiceMock.saveMessage.calls[1];
  assert.equal(assistantSave[2], 'assistant');
  assert.equal(assistantSave[3], 'Nested structured summary');
  assert.equal(assistantSave[4], 'trends');
  assert.deepEqual(assistantSave[5], { summary: 'Nested structured summary' });
  assert.deepEqual(assistantSave[6], { nested: true });
  assert.deepEqual(assistantSave[7], { status: 'ok' });
  assert.equal(assistantSave[8], 'https://example.com/image.png');
  assert.equal(assistantSave[9], 'image/png');
  assert.equal(assistantSave[10], 'Example image');
  assert.equal(assistantSave[11], 'nested-correlation-id');

  assert.equal(supabaseServiceMock.logAuditMessage.calls.length, 2);
  const auditEntry = supabaseServiceMock.logAuditMessage.calls[1][2];
  assert.equal(auditEntry.response, 'Nested structured summary');
  assert.equal(auditEntry.delivery, 'immediate');
  assert.equal(auditEntry.correlationId, 'nested-correlation-id');
}

async function run() {
  await testAsyncFlow();
  await testCachedFlow();
  await testNestedOutputFlow();
}

run()
  .then(() => {
    console.log('WebSocketService tests passed');
    process.exit(0);
  })
  .catch(error => {
    console.error('WebSocketService tests failed');
    console.error(error);
    process.exit(1);
  });
