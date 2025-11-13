# WebChannel Server

Real-time WebSocket server for the WebChannel omnichannel messaging platform. Integrates with n8n workflows and provides intelligent caching, session management, and message routing.

## Features

- **Real-time WebSocket Communication**: Bi-directional messaging with automatic reconnection
- **Intelligent 30-Minute Caching**: Reduces n8n load by 70-90% for repeated navigation
- **Session Management**: Handles 2,000-3,000 concurrent connections with heartbeat monitoring
- **n8n Integration**: Seamless webhook integration with Evolution API compatibility
- **Security**: JWT authentication, API key validation, rate limiting
- **Monitoring**: Prometheus metrics, health checks, structured logging
- **Rich Media Support**: Images, videos, and links with in-screen rendering

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────┐
│   React     │◄───WS───┤  WebSocket   │◄───HTTP─┤  n8n    │
│   Client    │         │    Server    │         │ Webhook │
└─────────────┘         └──────────────┘         └─────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │   Supabase   │
                        │   Database   │
                        └──────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase project configured
- n8n instance with webhook endpoint

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp ../.env.example ../.env
# Edit .env with your configuration

# Build TypeScript
npm run build:server

# Run server
npm run server
```

### Development

```bash
# Run in development mode with hot reload
npm run dev:server
```

## Configuration

All configuration is done through environment variables. See `.env.example` for complete reference.

### Required Variables

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# n8n Integration
N8N_WEBHOOK_URL=https://your-n8n.com/webhook/your-id/chat
N8N_API_KEY=your-n8n-api-key

# Security
ADMIN_API_KEY=your-admin-key
```

### Optional Variables

```env
# Server
WEBSOCKET_PORT=8080
WEBSOCKET_PATH=/ws
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Cache (30-minute default)
CACHE_TTL_MS=1800000
CACHE_STALE_MS=300000
CACHE_MAX_ITEMS=2000

# Session
HEARTBEAT_INTERVAL_MS=30000
SESSION_TIMEOUT_MS=300000

# Rate Limits
USER_RATE_LIMIT=10
API_RATE_LIMIT=100
```

## API Endpoints

### Health & Monitoring

- `GET /health` - Basic health check
- `GET /ready` - Readiness check (includes database connectivity)
- `GET /metrics` - Prometheus metrics

### Message Delivery (n8n → Client)

- `POST /api/messages/send` - Send message to user via WebSocket
  - Headers: `Authorization: Bearer {N8N_API_KEY}`
  - Body:
    ```json
    {
      "sessionId": "session_xxx",
      "userId": "uuid",
      "userEmail": "user@example.com",
      "content": "Message text",
      "contentType": "text",
      "structuredData": {},
      "metadata": {},
      "mediaUrl": "https://...",
      "mediaType": "image/jpeg",
      "cacheTag": "trends:d=2025-11-05"
    }
    ```

#### Manual verification: structured data only payloads

1. Start the development server with `npm run dev:server` and connect a WebSocket client using a known `sessionId`.
2. Send a request to `POST /api/messages/send` with the following JSON body:

   ```json
   {
     "sessionId": "session_xxx",
     "structuredData": {
       "type": "card",
       "title": "Structured Only"
     }
   }
   ```

3. Confirm the API responds with HTTP 200 and the WebSocket client receives a `message` event whose `structuredData` field contains the payload even though `content` is empty.

### Admin Endpoints

- `POST /admin/cache/invalidate` - Invalidate cache entries
  - Headers: `Authorization: Bearer {ADMIN_API_KEY}`
  - Body:
    ```json
    {
      "keys": ["trends:d=2025-11-05"],
      "prefix": "trends:",
      "reason": "Data updated"
    }
    ```

- `GET /admin/cache/stats` - Get cache statistics
- `GET /admin/sessions` - List active sessions

## WebSocket Protocol

### Client → Server Messages

```typescript
// Send chat message
{
  "type": "message",
  "content": "assuntos"
}

// Typing indicators
{
  "type": "typing_start"
}

// Read receipts
{
  "type": "read_receipt",
  "messageId": "msg_xxx"
}

// Heartbeat
{
  "type": "ping"
}
```

### Server → Client Messages

```typescript
// Connection established
{
  "type": "connected",
  "sessionId": "session_xxx",
  "message": "Connected to WebChannel"
}

// AI typing
{
  "type": "typing_start",
  "message": "Quenty-AI is thinking..."
}

// Message from AI
{
  "type": "message",
  "role": "assistant",
  "content": "Response text",
  "contentType": "text",
  "correlationId": "corr_xxx"
}

// Error
{
  "type": "error",
  "error": "Error message"
}
```

## Caching System

The server implements intelligent caching with stale-while-revalidate pattern:

### Cacheable Requests

- **Trends**: `assuntos` → Key: `trends:d=2025-11-05`
- **Topics**: `Assunto #1` → Key: `topics:trend_id=1&d=2025-11-05`
- **Summary**: `Tópico #1` → Key: `summary:topic_id=1&uid=hash&d=2025-11-05`

### Cache Behavior

- **TTL**: 30 minutes (1800000ms)
- **Stale Window**: 5 minutes (300000ms)
- **Max Items**: 2000 entries (~10-20 MB)
- **Day Rollover**: Automatic cache miss on new day

### Cache Invalidation

```bash
# Via API
curl -X POST http://localhost:8080/admin/cache/invalidate \
  -H "Authorization: Bearer your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"prefix": "trends:", "reason": "Data updated"}'

# From n8n workflow
POST /admin/cache/invalidate
Authorization: Bearer your-admin-key
{
  "keys": ["trends:d=2025-11-05"],
  "reason": "New ingestion completed"
}
```

## Monitoring

### Prometheus Metrics

Available at `GET /metrics`:

- `websocket_connections_active` - Current WebSocket connections
- `cache_hits_total` - Total cache hits
- `cache_misses_total` - Total cache misses
- `cache_entries` - Current cache entries
- `cache_inflight` - In-flight requests
- `cache_evictions_total` - Total cache evictions

### Logging

Structured JSON logging with pino:

```json
{
  "level": "info",
  "time": "2025-11-05T12:00:00.000Z",
  "msg": "Session created",
  "sessionId": "session_xxx",
  "userId": "uuid",
  "userEmail": "user@example.com"
}
```

Log levels: `error`, `warn`, `info`, `debug`

## n8n Integration

### Webhook Payload Format

Server sends Evolution API-compatible format:

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
    "date_time": "2025-11-05T12:00:00.000Z",
    "source": "web-app",
    "session_id": "session_xxx",
    "correlation_id": "corr_xxx"
  }
]
```

### n8n Response Handling

n8n should respond with:

```json
{
  "text": "Response text",
  "message": "Response text",
  "response": "Response text",
  "content": "Response text"
}
```

Server extracts first available field and sends to client.

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY server/dist ./server/dist
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
```

### Environment

Ensure all required environment variables are set in production:

```bash
# Check configuration
node -e "require('dotenv').config(); console.log(process.env.N8N_WEBHOOK_URL)"
```

### Scaling

For >3,000 concurrent connections:

1. **Horizontal Scaling**: Use Redis for shared session state
2. **Load Balancer**: Configure sticky sessions (IP hash)
3. **Database**: Connection pooling (10-20 connections per instance)
4. **Cache**: Consider Redis for shared cache across instances

## Troubleshooting

### Connection Issues

```bash
# Test WebSocket connection
wscat -c "ws://localhost:8080/ws?token=your-jwt-token"

# Check server logs
tail -f logs/server.log
```

### Cache Issues

```bash
# View cache stats
curl http://localhost:8080/admin/cache/stats \
  -H "Authorization: Bearer your-admin-key"

# Clear all cache
curl -X POST http://localhost:8080/admin/cache/invalidate \
  -H "Authorization: Bearer your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### n8n Webhook Issues

```bash
# Test webhook directly
curl -X POST https://your-n8n.com/webhook/your-id/chat \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"key":{"remoteJid":"web:test@example.com"},"web":"test@example.com","telegram":null,"message":{"conversation":"test"}},"date_time":"2025-11-05T12:00:00.000Z","source":"web-app"}]'
```

## Development

### Project Structure

```
server/
├── src/
│   ├── config/           # Configuration management
│   ├── middleware/       # Express middleware
│   ├── routes/           # HTTP routes
│   ├── services/         # Core services
│   │   ├── cache.ts      # LRU cache service
│   │   ├── session.ts    # Session management
│   │   ├── websocket.ts  # WebSocket handler
│   │   ├── n8n.ts        # n8n integration
│   │   └── supabase.ts   # Database client
│   ├── types/            # TypeScript types
│   ├── utils/            # Utility functions
│   └── index.ts          # Server entry point
├── dist/                 # Compiled JavaScript
└── tsconfig.json         # TypeScript config
```

### Testing

```bash
# Unit tests (when implemented)
npm test

# Integration tests
npm run test:integration

# Load tests
npm run test:load
```

## License

Private - All rights reserved
