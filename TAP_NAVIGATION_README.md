# Tap Navigation API Documentation

## Quick Links

📚 **Start Here**: [TAP_NAVIGATION_SUMMARY.md](./TAP_NAVIGATION_SUMMARY.md) - 5-minute overview

📖 **Full Reference**: [TAP_NAVIGATION_API_SPEC.md](./TAP_NAVIGATION_API_SPEC.md) - Complete API specification

📊 **Visual Guide**: [TAP_NAVIGATION_FLOW.md](./TAP_NAVIGATION_FLOW.md) - Flow diagrams and examples

## What is Tap Navigation?

Tap Navigation is a mobile-first, card-based UI for Quenty WebChannel 2.0 that provides an alternative to the conversational chat interface. Users navigate through three layers by tapping cards:

1. **Layer 1**: Top 15 Trends (expandable cards)
2. **Layer 2**: Top 10 Topics per trend (mini-cards within expanded trend)
3. **Layer 3**: Detailed summary (full-screen overlay)

> **Architecture update**: Trends and topics now come directly from Supabase `daily_trends` (latest `batch_ts`, `payload.trends` + `trendsSummary`). The assistant/WebSocket is only used to generate summaries, using the trend/topic IDs from that payload.

## For n8n Backend Developers

### Three Request Patterns to Implement

Your n8n workflow needs to recognize these three patterns:

| Pattern | Request | Response Type |
|---------|---------|---------------|
| Get Trends | `"assuntos"` | Array of 15 trend objects |
| Get Topics | `"Assunto #N"` (N=1-15) | Array of 10 topic objects + metadata |
| Get Summary | `"Tópico #N"` (N=1-10) | Summary object with content |

### Quick Start

1. **Detect the pattern** in `message.conversation`
2. **Generate the data** according to specification
3. **Set contentType** (`"trends"`, `"topics"`, or `"summary"`)
4. **Return via** `/api/messages/send` with your N8N_API_KEY

### Example Implementation

```javascript
const msg = input.data.message.conversation;

if (msg === "assuntos") {
  return { contentType: "trends", structuredData: [...] };
}

if (/^Assunto #\d+$/.test(msg)) {
  return { contentType: "topics", structuredData: [...], metadata: {...} };
}

if (/^Tópico #\d+$/.test(msg)) {
  return { contentType: "summary", structuredData: {...} };
}

// Default: existing chat
return { contentType: "text", content: "..." };
```

## Key Features

- **Caching**: 30-minute server-side cache (70-90% hit rate)
- **Backward Compatible**: Existing chat interface unchanged
- **Same Endpoint**: Use your current n8n webhook
- **No Breaking Changes**: Just 3 new patterns to detect

## Documentation Structure

```
TAP_NAVIGATION_SUMMARY.md       (5 min read)
├─ What you need to know
├─ Three request patterns
├─ Required fields reference
└─ Testing commands

TAP_NAVIGATION_API_SPEC.md      (20 min read)
├─ Complete API reference
├─ Request/response examples
├─ Field specifications
├─ Cache strategy
├─ Error handling
└─ Testing & validation

TAP_NAVIGATION_FLOW.md          (10 min read)
├─ Visual flow diagrams
├─ Cache behavior timeline
├─ Data structure examples
├─ n8n implementation checklist
└─ Quick reference code
```

## Testing Your Implementation

```bash
# Test all three patterns
curl -X POST $N8N_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"message":{"conversation":"assuntos"}}}]'

curl -X POST $N8N_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"message":{"conversation":"Assunto #1"}}}]'

curl -X POST $N8N_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"message":{"conversation":"Tópico #3"}}}]'
```

## Expected Load

- **Cache Hit Rate**: 70-90% after warmup
- **Daily Webhook Calls**: 100-300 (for 2000 users)
- **Response Time Target**: < 10 seconds (< 60 seconds acceptable)
- **Peak Traffic**: Morning digest (8-10 AM)

## Implementation Checklist

For n8n developers:

- [ ] Add pattern detection for three request types
- [ ] Implement trends data generation (15 objects)
- [ ] Implement topics data generation (10 objects per trend)
- [ ] Implement summary content generation
- [ ] Set correct `contentType` in responses
- [ ] Include all required fields per specification
- [ ] Test with provided curl commands
- [ ] Verify response times < 10 seconds
- [ ] Handle error cases gracefully

## Support

- **Questions?** See FAQ in TAP_NAVIGATION_SUMMARY.md
- **Full Details?** See TAP_NAVIGATION_API_SPEC.md
- **Visual Help?** See TAP_NAVIGATION_FLOW.md

## Frontend Implementation

The frontend tap navigation UI will be implemented separately in the WebChannel client. The current chat interface will continue to work unchanged. Users can switch between modes via the `VITE_CHANNEL_UI` environment variable.

---

**Next Steps**: Read [TAP_NAVIGATION_SUMMARY.md](./TAP_NAVIGATION_SUMMARY.md) for implementation details.
