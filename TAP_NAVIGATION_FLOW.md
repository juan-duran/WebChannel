# Quenty WebChannel 2.0 - Tap Navigation Flow Diagram

## Request/Response Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         QUENTY WEBCHANNEL 2.0                           │
│                        Tap Navigation Interface                          │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                                    ┌─────────────────┐
│                  │                                    │                 │
│  User Interface  │                                    │  WebChannel     │
│  (React Client)  │                                    │  Server         │
│                  │                                    │  (Node.js)      │
└──────────────────┘                                    └─────────────────┘
         │                                                      │
         │ 1. User taps "Get Trends"                          │
         ├────────────────────────────────────────────────────►│
         │    WebSocket: "assuntos"                           │
         │                                                     │
         │                                      ┌──────────────┴──────────┐
         │                                      │ Check Cache             │
         │                                      │ Key: trends:d=2025-11-10│
         │                                      └──────────────┬──────────┘
         │                                                     │
         │                                      ┌──────────────▼──────────┐
         │                                      │ Cache Hit?              │
         │                                      └──────────────┬──────────┘
         │                                                     │
         │                                      YES ◄──────────┴─────────► NO
         │                                       │                         │
         │                     ┌─────────────────▼─────┐        ┌────────▼────────┐
         │                     │ Return Cached Data    │        │ Call n8n        │
         │                     │ (Instant < 10ms)      │        │ Webhook         │
         │                     └─────────────────┬─────┘        └────────┬────────┘
         │                                       │                        │
         │◄──────────────────────────────────────┴────────────────────────┘
         │ 2. Receive Trends Array                                  
         │    contentType: "trends"                                 
         │    structuredData: [15 trends]                          
         │                                                          
         │ [User sees 15 trend cards]                              
         │                                                          
         │ 3. User taps "Trend #1" to expand                       
         ├────────────────────────────────────────────────────────►│
         │    WebSocket: "Assunto #1"                             │
         │                                                         │
         │                                      ┌─────────────────┴────────────┐
         │                                      │ Check Cache                  │
         │                                      │ Key: topics:trend_id=1&d=... │
         │                                      └─────────────────┬────────────┘
         │                                                        │
         │◄───────────────────────────────────────────────────────┘
         │ 4. Receive Topics Array                                
         │    contentType: "topics"                               
         │    structuredData: [10 topics]                         
         │    metadata: { trendName: "..." }                      
         │                                                         
         │ [Trend card expands, shows 10 topic cards]            
         │                                                         
         │ 5. User taps "Topic #3"                                
         ├────────────────────────────────────────────────────────►│
         │    WebSocket: "Tópico #3"                              │
         │                                                         │
         │                                      ┌─────────────────┴───────────────┐
         │                                      │ Check Cache                     │
         │                                      │ Key: summary:topic_id=3&uid=... │
         │                                      └─────────────────┬───────────────┘
         │                                                        │
         │◄───────────────────────────────────────────────────────┘
         │ 6. Receive Summary Object                              
         │    contentType: "summary"                              
         │    structuredData: { topicName, content, sources... }  
         │                                                         
         │ [Full-screen overlay with summary content]             
         │                                                         
```

## Three Request Patterns

### Pattern 1: Get Trends
```
USER ACTION:     Opens app / Taps refresh
CLIENT SENDS:    "assuntos"
SERVER CHECKS:   trends:d=2025-11-10
N8N RECEIVES:    message.conversation = "assuntos"
N8N RETURNS:     Array of 15 trend objects
CLIENT RENDERS:  15 expandable trend cards
```

### Pattern 2: Get Topics
```
USER ACTION:     Taps trend card to expand
CLIENT SENDS:    "Assunto #1" (or #2, #3, etc.)
SERVER CHECKS:   topics:trend_id=1&d=2025-11-10
N8N RECEIVES:    message.conversation = "Assunto #1"
N8N RETURNS:     Array of 10 topic objects + metadata
CLIENT RENDERS:  10 topic cards inside expanded trend
```

### Pattern 3: Get Summary
```
USER ACTION:     Taps topic card
CLIENT SENDS:    "Tópico #3" (or #1, #2, etc.)
SERVER CHECKS:   summary:topic_id=3&uid=hash&d=2025-11-10
N8N RECEIVES:    message.conversation = "Tópico #3"
N8N RETURNS:     Summary object with content + sources
CLIENT RENDERS:  Full-screen overlay with formatted content
```

## Cache Behavior Timeline

```
Time: 00:00 - User opens app
├─► Request: "assuntos"
├─► Cache: MISS
├─► n8n: Called (5s response)
├─► Cache: Stored (TTL=30min, expires at 00:30)
└─► User: Sees 15 trends

Time: 00:02 - User taps Trend #1
├─► Request: "Assunto #1"
├─► Cache: MISS
├─► n8n: Called (7s response)
├─► Cache: Stored (TTL=30min, expires at 00:32)
└─► User: Sees 10 topics

Time: 00:03 - User taps Topic #3
├─► Request: "Tópico #3"
├─► Cache: MISS
├─► n8n: Called (10s response)
├─► Cache: Stored (TTL=15min, expires at 00:18)
└─► User: Sees summary

Time: 00:05 - User goes back, opens Trend #1 again
├─► Request: "Assunto #1"
├─► Cache: HIT (fresh, age=3min)
└─► User: Sees 10 topics (instant, <10ms)

Time: 00:10 - User opens app on different device
├─► Request: "assuntos"
├─► Cache: HIT (fresh, age=10min)
└─► User: Sees 15 trends (instant, <10ms)

Time: 00:35 - User taps refresh on trends
├─► Request: "assuntos"
├─► Cache: EXPIRED (age=35min > 30min TTL)
├─► Stale-While-Revalidate: Shows cached data immediately
├─► Background: n8n called (5s response)
├─► Cache: Updated
└─► UI: Fades to new data with toast "Updated"
```

## Data Structure Examples

### Request 1: Trends
```json
// What client sends
{
  "type": "message",
  "content": "assuntos"
}

// What n8n receives (via webhook)
{
  "message": {
    "conversation": "assuntos"
  }
}

// What n8n returns (via /api/messages/send)
{
  "contentType": "trends",
  "structuredData": [
    {
      "id": "trend_1",
      "rank": 1,
      "title": "TECHNOLOGY & COMPETITION",
      "summary": "Alert on global AI race...",
      "upvotes": 406,
      "comments": 112,
      "newComments": 0,
      "threads": 36,
      "link": "https://s.quenty.com.br/8ezz7c",
      "whyItMatters": "Innovation shaping markets..."
    }
    // ... 14 more
  ]
}
```

### Request 2: Topics
```json
// What client sends
{
  "type": "message",
  "content": "Assunto #1"
}

// What n8n receives (via webhook)
{
  "message": {
    "conversation": "Assunto #1"
  }
}

// What n8n returns
{
  "contentType": "topics",
  "structuredData": [
    {
      "id": "topic_1_1",
      "rank": 1,
      "title": "OpenAI's GPT-5 announcement",
      "summary": "New model capabilities...",
      "comments": 54,
      "threads": 12,
      "link": "https://s.quenty.com.br/x9z87",
      "whyItMatters": "Signals next phase..."
    }
    // ... 9 more
  ],
  "metadata": {
    "trendName": "TECHNOLOGY & COMPETITION",
    "trendRank": 1
  }
}
```

### Request 3: Summary
```json
// What client sends
{
  "type": "message",
  "content": "Tópico #3"
}

// What n8n receives (via webhook)
{
  "message": {
    "conversation": "Tópico #3"
  }
}

// What n8n returns
{
  "contentType": "summary",
  "structuredData": {
    "topicName": "Chinese AI export policies",
    "trendName": "TECHNOLOGY & COMPETITION",
    "content": "**Chinese AI export policies**\n\nChina has...",
    "sources": [
      {
        "title": "Reuters - China AI Export Rules",
        "url": "https://reuters.com/article/...",
        "publishedAt": "2025-11-09T10:00:00Z"
      }
    ],
    "lastUpdated": "2025-11-10T13:00:00Z",
    "whyItMatters": "Signals regulatory frontier..."
  }
}
```

## n8n Implementation Checklist

### Step 1: Request Detection
- [ ] Add switch/if statement on `message.conversation`
- [ ] Case 1: Exact match "assuntos" → Generate trends
- [ ] Case 2: Regex match "Assunto #(\d+)" → Extract number, generate topics
- [ ] Case 3: Regex match "Tópico #(\d+)" → Extract number, generate summary
- [ ] Default: Treat as conversational chat (existing behavior)

### Step 2: Data Generation
- [ ] Trends: Query/aggregate top 15 trends with all required fields
- [ ] Topics: Query/aggregate top 10 topics for given trend ID
- [ ] Summary: Generate/retrieve detailed content for given topic ID

### Step 3: Response Formatting
- [ ] Set `contentType` correctly ("trends", "topics", "summary")
- [ ] Format `structuredData` as array (trends/topics) or object (summary)
- [ ] Include all required fields per specification
- [ ] Add metadata with timestamps and context

### Step 4: Response Delivery
- [ ] POST to `/api/messages/send` endpoint
- [ ] Include Authorization header with N8N_API_KEY
- [ ] Include sessionId from original request
- [ ] Handle timeout/error cases with user-friendly messages

### Step 5: Testing
- [ ] Test "assuntos" → Returns 15 trends
- [ ] Test "Assunto #1" → Returns 10 topics
- [ ] Test "Tópico #3" → Returns summary with sources
- [ ] Test error cases → Returns text contentType with error message
- [ ] Verify response times < 10 seconds

## Quick Reference: Pattern Matching

```javascript
// Pseudocode for n8n pattern detection

const message = input.data.message.conversation;

if (message === "assuntos") {
  // Generate trends response
  return {
    contentType: "trends",
    structuredData: generateTrends() // Array of 15
  };
}

const trendMatch = message.match(/^Assunto #(\d+)$/);
if (trendMatch) {
  const trendId = trendMatch[1];
  // Generate topics response
  return {
    contentType: "topics",
    structuredData: generateTopics(trendId), // Array of 10
    metadata: { trendName: "...", trendRank: trendId }
  };
}

const topicMatch = message.match(/^Tópico #(\d+)$/);
if (topicMatch) {
  const topicId = topicMatch[1];
  // Generate summary response
  return {
    contentType: "summary",
    structuredData: {
      topicName: "...",
      trendName: "...",
      content: "...",
      sources: [...],
      lastUpdated: new Date().toISOString(),
      whyItMatters: "..."
    }
  };
}

// Default: conversational chat
return {
  contentType: "text",
  content: "..." // Existing chat response
};
```

## Notes
- All three patterns are **cacheable** at the WebChannel server level
- n8n will receive significantly fewer requests after cache warmup (70-90% hit rate)
- Response times should target < 10 seconds but can go up to 60 seconds for complex summaries
- The frontend will show progressive loading messages during long waits
- Error responses should use `contentType: "text"` with error details in metadata

