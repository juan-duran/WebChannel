# WebChannel Deployment Guide

Complete deployment guide for the WebChannel omnichannel messaging platform with n8n integration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Building for Production](#building-for-production)
4. [Deployment Options](#deployment-options)
5. [Post-Deployment](#post-deployment)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Services

- **Supabase Project**: Database and authentication
- **n8n Instance**: Workflow automation with webhook endpoints
- **Node.js 18+**: Runtime environment
- **Domain/Hosting**: For production deployment

### Required Information

Before deployment, gather:

1. **Supabase Credentials**:
   - Project URL
   - Anon Key
   - Service Role Key (optional, for enhanced features)

2. **n8n Configuration**:
   - Webhook URL for incoming messages
   - API key for securing n8n → WebChannel communication

3. **API Keys** (generate secure random strings):
   - N8N_API_KEY (for n8n to send messages)
   - ADMIN_API_KEY (for cache management)

### Generate Secure Keys

```bash
# Generate secure API keys (macOS/Linux)
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Environment Configuration

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Configure Required Variables

Edit `.env` with your values:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-actual-key
SUPABASE_SERVICE_KEY=eyJhbGc...your-service-key

# n8n Integration
N8N_WEBHOOK_URL=https://your-n8n.app.n8n.cloud/webhook/your-id/chat
N8N_API_KEY=your-secure-n8n-api-key-here
WEBHOOK_TIMEOUT_MS=120000
WEBHOOK_RETRY_ATTEMPTS=3

# Server Configuration
WEBSOCKET_PORT=8080
WEBSOCKET_PATH=/ws
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Security (CRITICAL - Use strong keys)
ADMIN_API_KEY=your-secure-admin-api-key-here
USER_RATE_LIMIT=10
API_RATE_LIMIT=100

# Cache Configuration
CACHE_TTL_MS=1800000
CACHE_STALE_MS=300000
CACHE_MAX_ITEMS=2000

# Session Configuration
HEARTBEAT_INTERVAL_MS=30000
SESSION_TIMEOUT_MS=300000

# Media Configuration
ALLOWED_MEDIA_TYPES=image/jpeg,image/png,image/gif,video/mp4,video/webm
MAX_MEDIA_SIZE=10485760

# Logging
LOG_LEVEL=info
```

### 3. Configure n8n Webhook

In your n8n workflow:

1. Add Webhook node
2. Set HTTP Method: POST
3. Set Path: `/webhook/your-id/chat`
4. Add authentication if desired

## Building for Production

### 1. Install Dependencies

```bash
npm ci --production=false
```

### 2. Build Application

```bash
# Build both frontend and backend
npm run build

# Output:
# - Frontend: dist/
# - Backend: server/dist/
```

### 3. Verify Build

```bash
# Check frontend build
ls -lh dist/

# Check backend build
ls -lh server/dist/
```

## Deployment Options

### Option 1: Single Server Deployment

Deploy frontend and backend on the same server.

#### Step 1: Deploy Backend

```bash
# Start WebSocket server
npm run server

# Or with PM2 for production
npm install -g pm2
pm2 start server/dist/index.js --name webchannel-server
pm2 save
pm2 startup
```

#### Step 2: Deploy Frontend

Serve the `dist/` folder using nginx or any static file server.

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /path/to/project/dist;
        try_files $uri $uri/ /index.html;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Health checks
    location /health {
        proxy_pass http://localhost:8080;
    }

    location /metrics {
        proxy_pass http://localhost:8080;
        allow 127.0.0.1;
        deny all;
    }
}
```

### Option 2: Docker Deployment

#### Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/dist ./server/dist
COPY .env .env

EXPOSE 8080

CMD ["node", "server/dist/index.js"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  webchannel:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

#### Build and Run

```bash
# Build image
docker-compose build

# Run container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop container
docker-compose down
```

### Option 3: Vercel/Netlify + Separate Backend

#### Frontend (Vercel/Netlify)

Deploy `dist/` folder to Vercel or Netlify.

**Environment Variables:**
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Update WebSocket URL in `src/lib/websocket.ts`:
```typescript
const wsUrl = 'wss://your-backend-server.com/ws';
```

#### Backend (VPS/Cloud)

Deploy backend separately using Option 1 or Option 2.

## Post-Deployment

### 1. Verify Backend

```bash
# Check health
curl https://yourdomain.com/health

# Check readiness
curl https://yourdomain.com/ready

# Test WebSocket (using wscat)
npm install -g wscat
wscat -c "wss://yourdomain.com/ws?token=your-jwt-token"
```

### 2. Test n8n Integration

```bash
# Test webhook endpoint
curl -X POST https://your-n8n.com/webhook/your-id/chat \
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

### 3. Configure n8n Response Endpoint

In your n8n workflow, add HTTP Request node:

```
Method: POST
URL: https://yourdomain.com/api/messages/send
Headers:
  Authorization: Bearer {N8N_API_KEY}
  Content-Type: application/json
Body:
{
  "userEmail": "{{ $json.data.web }}",
  "content": "{{ $json.response }}",
  "contentType": "text"
}
```

### 4. Test End-to-End

1. Open application: `https://yourdomain.com`
2. Sign up / Log in
3. Send a test message
4. Verify:
   - Message appears in UI immediately
   - "Quenty-AI is thinking..." appears
   - Response arrives from n8n
   - Cache works on repeated navigation

## Monitoring

### 1. Set Up Prometheus

**prometheus.yml:**

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'webchannel'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
    bearer_token: 'your-admin-api-key'
```

### 2. Set Up Grafana Dashboard

Import metrics:
- `websocket_connections_active`
- `cache_hits_total`
- `cache_misses_total`
- `cache_entries`

### 3. Set Up Alerts

**Example Alert (Prometheus):**

```yaml
groups:
  - name: webchannel
    rules:
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
```

### 4. Log Aggregation

Configure log shipping to ELK/Loki:

```bash
# PM2 logs
pm2 logs webchannel-server --json | your-log-shipper

# Docker logs
docker-compose logs -f | your-log-shipper
```

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Update Nginx for WSS

Nginx config automatically upgrades HTTP → HTTPS and WS → WSS.

## Scaling

### Horizontal Scaling

For >3,000 concurrent connections:

1. **Add Load Balancer** (nginx/HAProxy)
2. **Enable Sticky Sessions** (IP hash)
3. **Shared State** (Redis for sessions/cache)
4. **Database Pooling** (10-20 connections per instance)

**Load Balancer Config (nginx):**

```nginx
upstream webchannel_backend {
    ip_hash;  # Sticky sessions
    server backend1:8080;
    server backend2:8080;
    server backend3:8080;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location /ws {
        proxy_pass http://webchannel_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/ {
        proxy_pass http://webchannel_backend;
    }
}
```

## Backup and Recovery

### Database Backups

Supabase handles automated backups. For additional safety:

```bash
# Export schema
pg_dump -h your-db.supabase.co -U postgres -d postgres --schema-only > schema.sql

# Export data
pg_dump -h your-db.supabase.co -U postgres -d postgres --data-only > data.sql
```

### Application Backups

```bash
# Backup environment config
cp .env .env.backup.$(date +%Y%m%d)

# Backup logs
tar -czf logs.$(date +%Y%m%d).tar.gz logs/
```

## Troubleshooting

### Backend Won't Start

```bash
# Check configuration
node -e "require('dotenv').config(); console.log(process.env)"

# Check port availability
lsof -i :8080

# Check logs
pm2 logs webchannel-server
# or
docker-compose logs
```

### WebSocket Connection Fails

```bash
# Test direct connection
wscat -c "ws://localhost:8080/ws?token=test"

# Check firewall
sudo ufw status
sudo ufw allow 8080/tcp

# Check nginx proxy
sudo nginx -t
sudo systemctl reload nginx
```

### Cache Not Working

```bash
# View cache stats
curl https://yourdomain.com/admin/cache/stats \
  -H "Authorization: Bearer your-admin-key"

# Clear cache
curl -X POST https://yourdomain.com/admin/cache/invalidate \
  -H "Authorization: Bearer your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### n8n Integration Issues

```bash
# Check n8n webhook
curl -v https://your-n8n.com/webhook/your-id/chat

# Test from server
curl -X POST $N8N_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '[{"event":"messages.upsert","data":{"key":{"remoteJid":"web:test@example.com"},"web":"test@example.com","telegram":null,"message":{"conversation":"test"}},"date_time":"2025-11-05T12:00:00Z","source":"web-app"}]'
```

## Security Checklist

- [ ] Strong API keys configured (32+ characters)
- [ ] SSL/TLS enabled for all endpoints
- [ ] CORS restricted to your domain only
- [ ] Rate limiting enabled
- [ ] Firewall configured (only 80, 443, 8080 open)
- [ ] Regular security updates: `npm audit fix`
- [ ] Environment variables not committed to git
- [ ] Supabase RLS policies enabled
- [ ] Metrics endpoint restricted to localhost/VPN
- [ ] Database backups configured
- [ ] Log monitoring configured

## Next Steps

1. **Set Up Monitoring**: Configure Prometheus + Grafana
2. **Configure Alerts**: Set up alerting for errors and downtime
3. **Load Testing**: Test with expected concurrent users
4. **Documentation**: Document your n8n workflows
5. **Training**: Train team on cache management and troubleshooting

## Support

For issues or questions:

1. Check server logs
2. Review this deployment guide
3. Check n8n workflow configuration
4. Verify environment variables
5. Test individual components

## Appendix

### Useful Commands

```bash
# View active connections
curl https://yourdomain.com/admin/sessions \
  -H "Authorization: Bearer your-admin-key"

# Monitor logs in real-time
pm2 logs webchannel-server --lines 100

# Check process status
pm2 status

# Restart server
pm2 restart webchannel-server

# View metrics
curl https://yourdomain.com/metrics
```

### Performance Tuning

```env
# High-traffic configuration
CACHE_MAX_ITEMS=5000
CACHE_TTL_MS=3600000
USER_RATE_LIMIT=20
HEARTBEAT_INTERVAL_MS=45000
```

### Development vs Production

**Development (.env):**
```env
LOG_LEVEL=debug
CORS_ALLOWED_ORIGINS=http://localhost:5173
WEBSOCKET_PORT=8080
```

**Production (.env):**
```env
LOG_LEVEL=info
CORS_ALLOWED_ORIGINS=https://yourdomain.com
WEBSOCKET_PORT=8080
NODE_ENV=production
```
