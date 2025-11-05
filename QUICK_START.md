# Quick Start Guide

Get WebChannel running locally in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Supabase project created
- n8n instance with webhook

## Step 1: Configure Environment

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` and update these required values:

```env
# Already configured (from your Supabase)
VITE_SUPABASE_URL=https://ivmwbyzrtmmffcsleidv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc... (already set)

# Update these with your values
N8N_WEBHOOK_URL=https://brian-jado.app.n8n.cloud/webhook/1475aa73-fde6-481b-9a13-58d50ac83b41/chat
N8N_API_KEY=your-secure-random-key-here
ADMIN_API_KEY=another-secure-random-key-here
```

**Generate secure keys:**
```bash
# Generate N8N_API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Build Server

```bash
npm run build:server
```

## Step 4: Start Development Servers

Open two terminal windows:

**Terminal 1: Start WebSocket Server**
```bash
npm run dev:server
```

You should see:
```
INFO: Configuration validated successfully
INFO: WebSocket server started { port: 8080, wsPath: '/ws' }
```

**Terminal 2: Start Frontend**
```bash
npm run dev
```

You should see:
```
VITE ready in 200 ms
Local: http://localhost:5173/
```

## Step 5: Test the Application

1. **Open Browser**: Navigate to http://localhost:5173

2. **Sign Up**: Create an account with any email/password

3. **Send Test Message**: Type "assuntos" and send

4. **Verify**:
   - Message appears immediately
   - "Quenty-AI is thinking..." shows
   - Response arrives from n8n (~60 seconds)

## Step 6: Configure n8n Webhook Response

In your n8n workflow, add an HTTP Request node at the end:

**Method**: POST
**URL**: `http://localhost:8080/api/messages/send`
**Headers**:
```
Authorization: Bearer YOUR_N8N_API_KEY
Content-Type: application/json
```

**Body**:
```json
{
  "userEmail": "{{ $json.data.web }}",
  "content": "{{ $json.response }}",
  "contentType": "text"
}
```

## Troubleshooting

### Server Won't Start

```bash
# Check port 8080 is available
lsof -i :8080

# If occupied, change port in .env
WEBSOCKET_PORT=8081
```

### WebSocket Connection Fails

```bash
# Test WebSocket directly
npm install -g wscat

# Get JWT token from browser (open DevTools → Application → Local Storage)
# Look for supabase auth token

wscat -c "ws://localhost:8080/ws?token=YOUR_JWT_TOKEN"
```

### Frontend Can't Connect

Edit `src/lib/websocket.ts` and verify the URL:
```typescript
const wsUrl = import.meta.env.DEV
  ? 'ws://localhost:8080/ws'  // ← Should match WEBSOCKET_PORT
  : `wss://${window.location.host}/ws`;
```

### n8n Not Receiving Messages

```bash
# Test webhook directly
curl -X POST "https://brian-jado.app.n8n.cloud/webhook/1475aa73-fde6-481b-9a13-58d50ac83b41/chat" \
  -H "Content-Type: application/json" \
  -d '[{
    "event": "messages.upsert",
    "data": {
      "key": {"remoteJid": "web:test@example.com"},
      "web": "test@example.com",
      "telegram": null,
      "message": {"conversation": "test"}
    },
    "date_time": "2025-11-05T12:00:00Z",
    "source": "web-app"
  }]'
```

## Verify Everything Works

### 1. Check Server Health

```bash
curl http://localhost:8080/health
# Should return: {"status":"ok","timestamp":"..."}

curl http://localhost:8080/ready
# Should return: {"status":"ready",...}
```

### 2. Check Cache Stats

```bash
curl http://localhost:8080/admin/cache/stats \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

### 3. Check Active Sessions

```bash
curl http://localhost:8080/admin/sessions \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

### 4. Test Cache

1. Send "assuntos" - should take ~60s for first response
2. Send "assuntos" again - should be instant (cache hit)
3. Check metrics:
```bash
curl http://localhost:8080/metrics | grep cache_hits
```

## Server Logs

View server logs in real-time:

```bash
# If running with dev:server
# Logs appear in Terminal 1

# If running with PM2
pm2 logs webchannel-server
```

## Common Test Scenarios

### Test 1: Basic Chat
```
User: assuntos
AI: [List of trends]
User: Assunto #1
AI: [List of topics for trend 1]
User: Tópico #1
AI: [Summary of topic 1]
```

### Test 2: Cache Verification
```
User: assuntos
AI: [Response after ~60s - MISS]
User: assuntos
AI: [Response instantly - HIT]
```

### Test 3: Reconnection
1. Send message "assuntos"
2. Stop server (Ctrl+C in Terminal 1)
3. Notice "Connection error" banner in UI
4. Start server again: `npm run dev:server`
5. UI should auto-reconnect within 30 seconds
6. Send message - should work normally

## View Metrics

### Prometheus Format

```bash
curl http://localhost:8080/metrics
```

Output:
```
# HELP websocket_connections_active Number of active WebSocket connections
# TYPE websocket_connections_active gauge
websocket_connections_active 1

# HELP cache_hits_total Total number of cache hits
# TYPE cache_hits_total counter
cache_hits_total 5

# HELP cache_misses_total Total number of cache misses
# TYPE cache_misses_total counter
cache_misses_total 2
...
```

## Production Deployment

Once everything works locally:

1. Follow [DEPLOYMENT.md](./DEPLOYMENT.md)
2. Update environment variables for production
3. Deploy to your server
4. Configure nginx reverse proxy
5. Enable SSL/TLS
6. Set up monitoring

## Need Help?

1. **Check Server Logs**: Terminal 1 shows all server activity
2. **Check Browser Console**: F12 → Console tab for frontend errors
3. **Review Documentation**:
   - [README.md](./README.md) - Overview
   - [server/README.md](./server/README.md) - API docs
   - [DEPLOYMENT.md](./DEPLOYMENT.md) - Production setup
   - [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Technical details

## Next Steps

After successful local testing:

1. ✅ Test all message types (trends, topics, summary)
2. ✅ Verify cache is working (instant second requests)
3. ✅ Test reconnection (stop/start server)
4. ✅ Check n8n integration (responses arrive)
5. ✅ Review metrics endpoint
6. 📋 Plan production deployment
7. 📋 Configure monitoring (Prometheus + Grafana)
8. 📋 Set up SSL certificates
9. 📋 Deploy to production
10. 📋 Load test with expected traffic

## Quick Reference

**Start Development:**
```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev
```

**Build for Production:**
```bash
npm run build
npm run server
```

**Useful Commands:**
```bash
# Check health
curl http://localhost:8080/health

# View cache stats
curl http://localhost:8080/admin/cache/stats \
  -H "Authorization: Bearer $ADMIN_API_KEY"

# Clear cache
curl -X POST http://localhost:8080/admin/cache/invalidate \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Test WebSocket
wscat -c "ws://localhost:8080/ws?token=YOUR_JWT"
```

**Environment Variables:**
```env
# Required
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
N8N_WEBHOOK_URL=...
N8N_API_KEY=...
ADMIN_API_KEY=...

# Optional (defaults shown)
WEBSOCKET_PORT=8080
CACHE_TTL_MS=1800000
LOG_LEVEL=info
```

---

**Ready to deploy?** → See [DEPLOYMENT.md](./DEPLOYMENT.md)
**Need API docs?** → See [server/README.md](./server/README.md)
**Questions?** → Check [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
