# Quenty WebChannel 2.0 - Tap Navigation Summary

## What You Need to Know

This document provides a quick overview of the tap navigation feature for n8n backend developers.

## Three Simple Request Patterns

Your n8n workflow needs to detect these three patterns in the `message.conversation` field:

### 1. Get Trends: `"assuntos"`
**When user opens the app or taps refresh**

```json
// You receive:
{
  "message": {
    "conversation": "assuntos"
  }
}

// You return:
{
  "contentType": "trends",
  "structuredData": [
    { "id": "trend_1", "rank": 1, "title": "...", "summary": "...", 
      "upvotes": 406, "comments": 112, "newComments": 0, "threads": 36,
      "link": "https://...", "whyItMatters": "..." },
    // ... 15 trends total
  ]
}
```

### 2. Get Topics: `"Assunto #N"`
**When user taps a trend card to expand it**

```json
// You receive:
{
  "message": {
    "conversation": "Assunto #1"  // or #2, #3, ... #15
  }
}

// You return:
{
  "contentType": "topics",
  "structuredData": [
    { "id": "topic_1_1", "rank": 1, "title": "...", "summary": "...",
      "comments": 54, "threads": 12, "link": "https://...", 
      "whyItMatters": "..." },
    // ... 10 topics total
  ],
  "metadata": {
    "trendName": "TECHNOLOGY & COMPETITION",
    "trendRank": 1
  }
}
```

### 3. Get Summary: `"Tópico #N"`
**When user taps a topic card**

```json
// You receive:
{
  "message": {
    "conversation": "Tópico #3"  // or #1, #2, ... #10
  }
}

// You return:
{
  "contentType": "summary",
  "structuredData": {
    "topicName": "Chinese AI export policies",
    "trendName": "TECHNOLOGY & COMPETITION",
    "content": "**Chinese AI export policies**\n\nFull text content here...",
    "sources": [
      { "title": "Reuters", "url": "https://...", "publishedAt": "2025-11-09T10:00:00Z" }
    ],
    "lastUpdated": "2025-11-10T13:00:00Z",
    "whyItMatters": "Signals regulatory frontier..."
  }
}
```

## Key Points

1. **Same Webhook**: Use your existing n8n webhook endpoint - no changes needed
2. **Pattern Matching**: Just add 3 simple if/regex checks on `message.conversation`
3. **Caching**: The WebChannel server caches responses (30 min for trends/topics, 15 min for summaries)
4. **Load Reduction**: Expect 70-90% fewer calls after cache warmup
5. **Backward Compatible**: Existing chat interface continues to work unchanged

## Implementation Steps

```javascript
// Pseudocode for n8n

const msg = input.data.message.conversation;

// Pattern 1: Exact match
if (msg === "assuntos") {
  return getTrends(); // Array of 15
}

// Pattern 2: Regex match
if (/^Assunto #(\d+)$/.test(msg)) {
  const trendId = msg.match(/^Assunto #(\d+)$/)[1];
  return getTopics(trendId); // Array of 10
}

// Pattern 3: Regex match
if (/^Tópico #(\d+)$/.test(msg)) {
  const topicId = msg.match(/^Tópico #(\d+)$/)[1];
  return getSummary(topicId); // Object with content
}

// Default: existing chat behavior
return getChatResponse(msg);
```

## Required Fields Reference

### Trend Object (15 required)
```typescript
{
  id: string;           // "trend_1"
  rank: number;         // 1-15
  title: string;        // "TECHNOLOGY & COMPETITION"
  summary: string;      // Brief description
  upvotes: number;      // Like count
  comments: number;     // Total comments
  newComments: number;  // New since last check
  threads: number;      // Discussion threads
  link: string;         // Short link
  whyItMatters: string; // Context
}
```

### Topic Object (10 required per trend)
```typescript
{
  id: string;           // "topic_1_3"
  rank: number;         // 1-10
  title: string;        // Topic headline
  summary: string;      // Brief description
  comments: number;     // Comment count
  threads: number;      // Thread count
  link: string;         // Short link
  whyItMatters: string; // Context
}
```

### Summary Object
```typescript
{
  topicName: string;     // Topic title
  trendName: string;     // Parent trend
  content: string;       // Full markdown text
  sources: Array<{       // Optional
    title: string;
    url: string;
    publishedAt?: string;
  }>;
  lastUpdated: string;   // ISO timestamp
  whyItMatters: string;  // Context
}
```

## Response Delivery

Send all responses to:
```
POST {WEBCHANNEL_SERVER}/api/messages/send
Authorization: Bearer {N8N_API_KEY}
Content-Type: application/json

{
  "sessionId": "session_abc123",  // From original request
  "userEmail": "user@example.com", // From original request
  "content": "Human-readable text",
  "contentType": "trends" | "topics" | "summary",
  "structuredData": { ... },
  "metadata": { ... }
}
```

## Testing

Use these curl commands to test your implementation:

```bash
# Test 1: Trends
curl -X POST {YOUR_N8N_WEBHOOK} \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"message":{"conversation":"assuntos"}}}]'

# Test 2: Topics
curl -X POST {YOUR_N8N_WEBHOOK} \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"message":{"conversation":"Assunto #1"}}}]'

# Test 3: Summary
curl -X POST {YOUR_N8N_WEBHOOK} \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"message":{"conversation":"Tópico #3"}}}]'
```

## Full Documentation

For complete details, see:
- **TAP_NAVIGATION_API_SPEC.md** - Complete API reference with all fields and examples
- **TAP_NAVIGATION_FLOW.md** - Visual diagrams and cache behavior timelines

## Questions?

Common scenarios:

**Q: What if I can't generate all 15 trends?**
A: Return what you have (minimum 5 recommended), adjust `totalTrends` in metadata

**Q: What about errors?**
A: Return `contentType: "text"` with error message, add error flag in metadata

**Q: Do I need to implement caching?**
A: No! WebChannel server handles all caching automatically

**Q: What's the expected response time?**
A: Target < 10 seconds, but up to 60 seconds is acceptable for complex summaries

**Q: Does this break existing chat?**
A: No! Chat continues to work. These are just 3 new patterns to detect.
