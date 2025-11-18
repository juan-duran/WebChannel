import { Router, Request, Response } from 'express';
import { sessionManager } from '../services/session.js';
import { cacheService } from '../services/cache.js';
import { supabaseService } from '../services/supabase.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'WebChannel service is running. See /health, /ready, or /metrics for details.',
  });
});

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseService.client
      .from('channels')
      .select('id')
      .limit(1);

    if (error) {
      throw error;
    }

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

router.get('/metrics', (req: Request, res: Response) => {
  const cacheMetrics = cacheService.getMetrics();
  const sessionCount = sessionManager.getActiveSessionCount();

  const metrics = [
    `# HELP websocket_connections_active Number of active WebSocket connections`,
    `# TYPE websocket_connections_active gauge`,
    `websocket_connections_active ${sessionCount}`,
    '',
    `# HELP cache_hits_total Total number of cache hits`,
    `# TYPE cache_hits_total counter`,
    `cache_hits_total ${cacheMetrics.hits}`,
    '',
    `# HELP cache_misses_total Total number of cache misses`,
    `# TYPE cache_misses_total counter`,
    `cache_misses_total ${cacheMetrics.misses}`,
    '',
    `# HELP cache_entries Current number of cache entries`,
    `# TYPE cache_entries gauge`,
    `cache_entries ${cacheMetrics.entries}`,
    '',
    `# HELP cache_inflight Current number of in-flight requests`,
    `# TYPE cache_inflight gauge`,
    `cache_inflight ${cacheMetrics.inflight}`,
    '',
    `# HELP cache_evictions_total Total number of cache evictions`,
    `# TYPE cache_evictions_total counter`,
    `cache_evictions_total ${cacheMetrics.evictions}`,
  ].join('\n');

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

export default router;
