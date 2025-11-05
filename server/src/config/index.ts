import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  server: {
    port: parseInt(optionalEnv('WEBSOCKET_PORT', '8080'), 10),
    path: optionalEnv('WEBSOCKET_PATH', '/ws'),
    corsOrigins: optionalEnv('CORS_ALLOWED_ORIGINS', 'http://localhost:5173').split(','),
  },

  supabase: {
    url: requireEnv('VITE_SUPABASE_URL'),
    anonKey: requireEnv('VITE_SUPABASE_ANON_KEY'),
    serviceKey: optionalEnv('SUPABASE_SERVICE_KEY', ''),
  },

  n8n: {
    webhookUrl: requireEnv('N8N_WEBHOOK_URL'),
    apiKey: requireEnv('N8N_API_KEY'),
    webhookTimeout: parseInt(optionalEnv('WEBHOOK_TIMEOUT_MS', '120000'), 10),
    retryAttempts: parseInt(optionalEnv('WEBHOOK_RETRY_ATTEMPTS', '3'), 10),
  },

  cache: {
    ttlMs: parseInt(optionalEnv('CACHE_TTL_MS', '1800000'), 10),
    staleMs: parseInt(optionalEnv('CACHE_STALE_MS', '300000'), 10),
    maxItems: parseInt(optionalEnv('CACHE_MAX_ITEMS', '2000'), 10),
  },

  security: {
    adminApiKey: requireEnv('ADMIN_API_KEY'),
    userRateLimit: parseInt(optionalEnv('USER_RATE_LIMIT', '10'), 10),
    apiRateLimit: parseInt(optionalEnv('API_RATE_LIMIT', '100'), 10),
  },

  session: {
    heartbeatInterval: parseInt(optionalEnv('HEARTBEAT_INTERVAL_MS', '30000'), 10),
    sessionTimeout: parseInt(optionalEnv('SESSION_TIMEOUT_MS', '300000'), 10),
  },

  media: {
    allowedTypes: optionalEnv('ALLOWED_MEDIA_TYPES', 'image/jpeg,image/png,image/gif,video/mp4,video/webm').split(','),
    maxSize: parseInt(optionalEnv('MAX_MEDIA_SIZE', '10485760'), 10),
  },

  logging: {
    level: optionalEnv('LOG_LEVEL', 'info'),
  },
};

export function validateConfig() {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'N8N_WEBHOOK_URL',
    'N8N_API_KEY',
    'ADMIN_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('Configuration validated successfully');
}
