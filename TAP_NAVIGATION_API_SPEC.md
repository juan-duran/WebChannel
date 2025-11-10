# Quenty WebChannel 2.0 - Tap Navigation API Specification

## Overview

This document specifies the API contract between the Quenty WebChannel 2.0 tap-based frontend and the n8n backend. The tap navigation interface uses the same webhook endpoint as the chat interface but introduces structured data formats for three distinct request types.

**Important**: All requests use the existing Evolution API-compatible payload format. The backend identifies request types by pattern-matching the `message.conversation` field.

---

## Common Request Format

All requests from the WebChannel frontend to n8n follow this structure:

### HTTP Request

```
POST {N8N_WEBHOOK_URL}
Content-Type: application/json
```

### Payload Structure

```json
[
  {
    "event": "messages.upsert",
    "data": {
      "key": {
        "remoteJid": "web:{userEmail}"
      },
      "web": "{userEmail}",
      "telegram": null,
      "message": {
        "conversation": "{REQUEST_PATTERN}"
      }
    },
    "date_time": "2025-11-10T15:30:00.000Z",
    "source": "web-app",
    "session_id": "session_abc123xyz",
    "correlation_id": "corr_def456uvw"
  }
]
```

### Common Fields

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Always `"messages.upsert"` |
| `data.key.remoteJid` | string | Format: `"web:{userEmail}"` (e.g., `"web:user@example.com"`) |
| `data.web` | string | User's email address |
| `data.telegram` | null | Always null for web source |
| `data.message.conversation` | string | **Request pattern** (see below for each type) |
| `date_time` | string | ISO 8601 timestamp |
| `source` | string | Always `"web-app"` |
| `session_id` | string | Unique session identifier (format: `session_{uuid}`) |
| `correlation_id` | string | Unique request identifier (format: `corr_{uuid}`) |

---

## Request Type 1: Get Trends (Top 15)

### Request Pattern

```json
{
  "message": {
    "conversation": "assuntos"
  }
}
```

### Detection Logic

- **Pattern**: Exact match `"assuntos"` (case-sensitive)
- **Cache Key**: `trends:d={YYYY-MM-DD}`
- **Cache TTL**: 30 minutes

### Full Request Example

```json
[
  {
    "event": "messages.upsert",
    "data": {
      "key": {
        "remoteJid": "web:user@example.com"
      },
      "web": "user@example.com",
      "telegram": null,
      "message": {
        "conversation": "assuntos"
      }
    },
    "date_time": "2025-11-10T15:30:00.000Z",
    "source": "web-app",
    "session_id": "session_a1b2c3d4",
    "correlation_id": "corr_e5f6g7h8"
  }
]
```

### Expected Response Format

n8n should respond via the `/api/messages/send` endpoint with:

```json
{
  "sessionId": "session_a1b2c3d4",
  "userId": "user_uuid",
  "userEmail": "user@example.com",
  "content": "Top 15 Trends for Today",
  "contentType": "trends",
  "structuredData": [
    {
      "id": "trend_1",
      "rank": 1,
      "title": "TECHNOLOGY & COMPETITION",
      "summary": "Alert on global AI race and Chinese leadership",
      "upvotes": 406,
      "comments": 112,
      "newComments": 0,
      "threads": 36,
      "link": "https://s.quenty.com.br/8ezz7c",
      "whyItMatters": "Innovation shaping markets, jobs and investment."
    },
    {
      "id": "trend_2",
      "rank": 2,
      "title": "CLIMATE POLICY",
      "summary": "New regulations on carbon emissions",
      "upvotes": 389,
      "comments": 98,
      "newComments": 5,
      "threads": 28,
      "link": "https://s.quenty.com.br/9faa8d",
      "whyItMatters": "Affects energy sector and transition strategies."
    }
    // ... up to 15 trends
  ],
  "metadata": {
    "fetchedAt": "2025-11-10T15:30:05.000Z",
    "totalTrends": 15
  }
}
```

### Response Field Specifications

#### Trend Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (format: `trend_{number}`) |
| `rank` | number | Yes | Position in ranking (1-15) |
| `title` | string | Yes | Category/trend title (ALL CAPS format preferred) |
| `summary` | string | Yes | Brief description (1-2 sentences) |
| `upvotes` | number | Yes | Number of upvotes/likes |
| `comments` | number | Yes | Total comment count |
| `newComments` | number | Yes | New comments since last check (can be 0) |
| `threads` | number | Yes | Number of discussion threads |
| `link` | string | Yes | Short link to full content (format: `https://s.quenty.com.br/{code}`) |
| `whyItMatters` | string | Yes | Context explanation (1 sentence) |

---

## Request Type 2: Get Topics (Top 10 per Trend)

### Request Pattern

```json
{
  "message": {
    "conversation": "Assunto #{rank}"
  }
}
```

### Detection Logic

- **Pattern**: Regex match `^Assunto #(\d+)$`
- **Extracted Value**: `{rank}` (1-15)
- **Cache Key**: `topics:trend_id={rank}&d={YYYY-MM-DD}`
- **Cache TTL**: 30 minutes

### Full Request Example

```json
[
  {
    "event": "messages.upsert",
    "data": {
      "key": {
        "remoteJid": "web:user@example.com"
      },
      "web": "user@example.com",
      "telegram": null,
      "message": {
        "conversation": "Assunto #1"
      }
    },
    "date_time": "2025-11-10T15:32:00.000Z",
    "source": "web-app",
    "session_id": "session_a1b2c3d4",
    "correlation_id": "corr_i9j0k1l2"
  }
]
```

### Expected Response Format

```json
{
  "sessionId": "session_a1b2c3d4",
  "userId": "user_uuid",
  "userEmail": "user@example.com",
  "content": "Top 10 Topics for TECHNOLOGY & COMPETITION",
  "contentType": "topics",
  "structuredData": [
    {
      "id": "topic_1_1",
      "rank": 1,
      "title": "OpenAI's GPT-5 announcement",
      "summary": "New model capabilities and competitive landscape.",
      "comments": 54,
      "threads": 12,
      "link": "https://s.quenty.com.br/x9z87",
      "whyItMatters": "Signals the next phase of AI advancement."
    },
    {
      "id": "topic_1_2",
      "rank": 2,
      "title": "Google's response strategy",
      "summary": "Bard updates and enterprise integrations.",
      "comments": 48,
      "threads": 10,
      "link": "https://s.quenty.com.br/y8a76",
      "whyItMatters": "Shows big tech defensive positioning."
    }
    // ... up to 10 topics
  ],
  "metadata": {
    "trendName": "TECHNOLOGY & COMPETITION",
    "trendRank": 1,
    "fetchedAt": "2025-11-10T15:32:05.000Z",
    "totalTopics": 10
  }
}
```

### Response Field Specifications

#### Topic Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (format: `topic_{trendRank}_{topicRank}`) |
| `rank` | number | Yes | Position within this trend (1-10) |
| `title` | string | Yes | Topic headline |
| `summary` | string | Yes | Brief description (1-2 sentences) |
| `comments` | number | Yes | Comment count for this topic |
| `threads` | number | Yes | Discussion thread count |
| `link` | string | Yes | Short link to topic details |
| `whyItMatters` | string | Yes | Context explanation (1 sentence) |

#### Metadata Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `trendName` | string | Yes | Parent trend title for breadcrumb |
| `trendRank` | number | Yes | Parent trend rank (1-15) |
| `fetchedAt` | string | Yes | ISO 8601 timestamp |
| `totalTopics` | number | Yes | Number of topics returned |

---

## Request Type 3: Get Summary (for a Topic)

### Request Pattern

```json
{
  "message": {
    "conversation": "Tópico #{rank}"
  }
}
```

### Detection Logic

- **Pattern**: Regex match `^Tópico #(\d+)$`
- **Extracted Value**: `{rank}` (1-10)
- **Cache Key**: `summary:topic_id={rank}&uid={emailHash}&d={YYYY-MM-DD}`
- **Cache TTL**: 15 minutes (shorter for personalized content)
- **Email Hashing**: SHA-256 hash of user email for cache key

### Full Request Example

```json
[
  {
    "event": "messages.upsert",
    "data": {
      "key": {
        "remoteJid": "web:user@example.com"
      },
      "web": "user@example.com",
      "telegram": null,
      "message": {
        "conversation": "Tópico #3"
      }
    },
    "date_time": "2025-11-10T15:35:00.000Z",
    "source": "web-app",
    "session_id": "session_a1b2c3d4",
    "correlation_id": "corr_m3n4o5p6"
  }
]
```

### Expected Response Format

```json
{
  "sessionId": "session_a1b2c3d4",
  "userId": "user_uuid",
  "userEmail": "user@example.com",
  "content": "**Chinese AI export policies**\n\nChina has implemented new regulations restricting the export of AI technologies...\n\n**Key Points:**\n- Export controls on large language models\n- Impact on international partnerships\n- Response from US and EU regulators\n\n**Analysis:**\nThis policy shift reflects China's strategic positioning in the global AI race...",
  "contentType": "summary",
  "structuredData": {
    "topicName": "Chinese AI export policies",
    "trendName": "TECHNOLOGY & COMPETITION",
    "content": "**Chinese AI export policies**\n\nChina has implemented new regulations restricting the export of AI technologies...\n\n**Key Points:**\n- Export controls on large language models\n- Impact on international partnerships\n- Response from US and EU regulators\n\n**Analysis:**\nThis policy shift reflects China's strategic positioning in the global AI race...",
    "sources": [
      {
        "title": "Reuters - China AI Export Rules",
        "url": "https://reuters.com/article/...",
        "publishedAt": "2025-11-09T10:00:00Z"
      },
      {
        "title": "Bloomberg - Trade Impact Analysis",
        "url": "https://bloomberg.com/news/...",
        "publishedAt": "2025-11-09T14:30:00Z"
      }
    ],
    "lastUpdated": "2025-11-10T13:00:00Z",
    "whyItMatters": "Signals the next regulatory frontier in AI geopolitics."
  },
  "metadata": {
    "topicRank": 3,
    "trendRank": 1,
    "fetchedAt": "2025-11-10T15:35:05.000Z",
    "wordCount": 450
  }
}
```

### Response Field Specifications

#### Summary StructuredData Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topicName` | string | Yes | Topic title for breadcrumb |
| `trendName` | string | Yes | Parent trend title for breadcrumb |
| `content` | string | Yes | Full summary text (markdown supported) |
| `sources` | array | Optional | Array of source objects (see below) |
| `lastUpdated` | string | Yes | ISO 8601 timestamp of content generation |
| `whyItMatters` | string | Yes | Context explanation (1-2 sentences) |

#### Source Object (Optional)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Source article/document title |
| `url` | string | Yes | Full URL to source |
| `publishedAt` | string | Optional | ISO 8601 timestamp |

#### Metadata Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topicRank` | number | Yes | Topic position within trend |
| `trendRank` | number | Yes | Parent trend rank |
| `fetchedAt` | string | Yes | ISO 8601 timestamp |
| `wordCount` | number | Optional | Approximate word count |

---

## Response Delivery

All responses from n8n must be sent back to the WebChannel server via:

```
POST {WEBCHANNEL_SERVER}/api/messages/send
Authorization: Bearer {N8N_API_KEY}
Content-Type: application/json
```

### Response Payload Structure

```json
{
  "sessionId": "session_a1b2c3d4",
  "userId": "user_uuid_from_supabase",
  "userEmail": "user@example.com",
  "content": "Human-readable text content",
  "contentType": "trends" | "topics" | "summary",
  "structuredData": { /* Type-specific structured data */ },
  "metadata": { /* Additional context */ }
}
```

### Response Field Requirements

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Optional | Session ID from original request (for WebSocket delivery) |
| `userId` | string | Optional | Supabase user UUID (for offline delivery) |
| `userEmail` | string | Optional | User email (fallback identifier) |
| `content` | string | Yes | Text content (used as fallback if client doesn't support structuredData) |
| `contentType` | string | Yes | One of: `"trends"`, `"topics"`, `"summary"`, `"text"` |
| `structuredData` | object/array | Yes* | Type-specific data (see above) |
| `metadata` | object | Optional | Additional context information |

**Note**: At least one of `sessionId`, `userId`, or `userEmail` must be provided for message routing.

---

## Caching Strategy

The WebChannel server implements a 30-minute caching layer for all three request types:

### Cache Keys

| Request Type | Cache Key Format | TTL |
|--------------|------------------|-----|
| Trends | `trends:d={YYYY-MM-DD}` | 30 min |
| Topics | `topics:trend_id={rank}&d={YYYY-MM-DD}` | 30 min |
| Summary | `summary:topic_id={rank}&uid={sha256(email)}&d={YYYY-MM-DD}` | 15 min |

### Cache Behavior

1. **First Request**: Cache miss → n8n webhook called → response cached → delivered to client
2. **Subsequent Requests**: Cache hit → instant delivery from cache (no n8n call)
3. **Manual Refresh**: User can force refresh if cache is valid and > 5 minutes old
4. **Date Boundary**: Cache auto-invalidates at midnight (UTC or local TZ)
5. **Stale-While-Revalidate**: If cache is stale (>30 min), serve cached data immediately and refresh in background

### n8n Optimization

Since caching happens at the WebChannel server level, n8n should:

- **Not implement its own caching** for these request patterns
- **Generate fresh data** on every webhook call
- **Expect significantly reduced load** (70-90% cache hit rate after warmup)

---

## Error Handling

### n8n Response Errors

If n8n encounters an error, it should still respond via `/api/messages/send` with:

```json
{
  "sessionId": "session_a1b2c3d4",
  "userEmail": "user@example.com",
  "content": "Sorry, I couldn't fetch the trends right now. Please try again.",
  "contentType": "text",
  "metadata": {
    "error": true,
    "errorCode": "FETCH_FAILED",
    "errorMessage": "Upstream service timeout"
  }
}
```

### Timeout Behavior

- **Webhook Timeout**: 120 seconds (configured in WebChannel server)
- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Client Timeout**: Frontend shows loading state for up to 60 seconds
- **Graceful Degradation**: If all retries fail, user sees error message with retry button

---

## Request Context and Correlation

### Session Tracking

- Each WebSocket connection gets a unique `session_id`
- Multiple requests from same session share the session ID
- n8n can use `session_id` to track conversation context

### Correlation IDs

- Each request gets a unique `correlation_id`
- Used for logging and debugging
- n8n should include `correlation_id` in logs for traceability

### User Identity

- `data.web` contains the authenticated user's email
- Email is verified via JWT before request is sent
- n8n can use email for personalization and access control

---

## Testing & Validation

### Test Request Patterns

```bash
# Test 1: Get Trends
curl -X POST {N8N_WEBHOOK_URL} \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"key":{"remoteJid":"web:test@example.com"},"web":"test@example.com","telegram":null,"message":{"conversation":"assuntos"}},"date_time":"2025-11-10T15:00:00Z","source":"web-app","session_id":"test_session","correlation_id":"test_corr_1"}]'

# Test 2: Get Topics
curl -X POST {N8N_WEBHOOK_URL} \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"key":{"remoteJid":"web:test@example.com"},"web":"test@example.com","telegram":null,"message":{"conversation":"Assunto #1"}},"date_time":"2025-11-10T15:00:00Z","source":"web-app","session_id":"test_session","correlation_id":"test_corr_2"}]'

# Test 3: Get Summary
curl -X POST {N8N_WEBHOOK_URL} \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"key":{"remoteJid":"web:test@example.com"},"web":"test@example.com","telegram":null,"message":{"conversation":"Tópico #3"}},"date_time":"2025-11-10T15:00:00Z","source":"web-app","session_id":"test_session","correlation_id":"test_corr_3"}]'
```

### Validation Checklist

- [ ] n8n recognizes all three request patterns
- [ ] Responses contain all required fields
- [ ] `contentType` matches request type
- [ ] `structuredData` follows specification
- [ ] Response delivered to `/api/messages/send` endpoint
- [ ] Authorization header includes N8N_API_KEY
- [ ] Response time < 10 seconds for typical requests
- [ ] Error responses handled gracefully

---

## Migration from Chat to Tap Navigation

### Backward Compatibility

The tap navigation requests are **fully compatible** with the existing chat-based flow:

- Same webhook endpoint
- Same payload structure
- Same authentication mechanism
- Existing chat interface continues to work unchanged

### Differentiation

The tap navigation UI can be identified by:

1. **Request Patterns**: `assuntos`, `Assunto #N`, `Tópico #N` are tap-specific
2. **Response Format**: `structuredData` with arrays/objects vs plain text
3. **Source Field**: Both use `"source": "web-app"` (no distinction needed)

### Coexistence

- Chat interface: User types free-form questions → n8n responds with conversational text
- Tap interface: User taps cards → n8n responds with structured data
- Both can operate simultaneously for different users
- Environment variable (`VITE_CHANNEL_UI`) controls client-side UI mode

---

## Summary for n8n Implementation

### Key Requirements

1. **Detect Request Pattern**: Match `message.conversation` against three patterns
2. **Generate Structured Data**: Return arrays of objects (trends/topics) or detailed object (summary)
3. **Include Metadata**: Always provide context (trendName, ranks, timestamps)
4. **Set contentType**: Must match data structure (`"trends"`, `"topics"`, `"summary"`)
5. **Send to Server**: POST to `/api/messages/send` with Bearer token
6. **Handle Errors**: Return user-friendly error messages with error metadata

### Expected Load

- **Cache Hit Rate**: 70-90% after initial warmup
- **Peak Load**: ~100-300 webhook calls per day (2000 users, 10% active hourly)
- **Burst Traffic**: Morning digest time (8-10 AM) may see 50-100 requests
- **Response Time**: Target < 5 seconds for cached responses, < 15 seconds for fresh data

---

## Contact & Support

For questions or clarification about this specification:

- **WebChannel Server Logs**: Check correlation IDs for request tracing
- **Test Endpoint**: Use provided curl commands for validation
- **Response Validation**: Compare actual responses against examples above

