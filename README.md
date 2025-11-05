# WebChannel - Omnichannel Messaging Platform

Real-time web chat application with n8n integration, intelligent caching, and seamless omnichannel support. Built with React, TypeScript, WebSocket, and Supabase.

## Features

### Real-time Communication
- **WebSocket Integration**: True bi-directional real-time messaging
- **Typing Indicators**: "Quenty-AI is thinking..." feedback during processing
- **Auto-Reconnection**: Resilient connection with exponential backoff
- **Session Management**: Handles 2,000-3,000 concurrent connections

### Intelligent Caching
- **30-Minute Cache**: Reduces n8n webhook calls by 70-90%
- **Stale-While-Revalidate**: Instant responses with background refresh
- **Day-Bound Keys**: Automatic cache invalidation on date rollover
- **Personalized Content**: User-specific cache keys for summaries

### n8n Integration
- **Evolution API Compatible**: Works with existing WhatsApp workflows
- **Unified Message Format**: Same payload structure across all channels
- **Webhook Retry Logic**: Automatic retry with exponential backoff
- **Cache Invalidation API**: n8n can trigger cache updates

### Rich Media Support
- **Images**: In-screen rendering with lazy loading
- **Videos**: Embedded player with controls
- **Links**: Automatic preview generation
- **Media Validation**: Type and size checking

### Security
- **JWT Authentication**: Supabase-powered user authentication
- **API Key Protection**: Separate keys for n8n and admin access
- **Rate Limiting**: User and API-level request throttling
- **Row Level Security**: Database-enforced access control

### Monitoring & Operations
- **Prometheus Metrics**: Connection counts, cache performance, errors
- **Health Checks**: /health and /ready endpoints for orchestration
- **Structured Logging**: JSON logs with correlation IDs
- **Admin Dashboard**: Cache stats and session management

## Quick Start

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete setup and deployment instructions.

### Development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Terminal 1: Start frontend
npm run dev

# Terminal 2: Start WebSocket server
npm run dev:server
```

## Documentation

- [Server Documentation](./server/README.md) - Backend API and WebSocket protocol
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions

## License

Private - All rights reserved
