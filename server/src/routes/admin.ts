import { Router, Request, Response } from 'express';
import { authenticateAdminKey } from '../middleware/auth.js';
import { cacheService } from '../services/cache.js';
import { sessionManager } from '../services/session.js';
import { supabaseService } from '../services/supabase.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/cache/invalidate', authenticateAdminKey, async (req: Request, res: Response) => {
  try {
    const { keys, prefix, reason } = req.body;

    if (!keys && !prefix) {
      return res.status(400).json({ error: 'Either keys or prefix is required' });
    }

    const count = cacheService.invalidate(keys, prefix);

    await supabaseService.logCacheInvalidation(
      prefix || keys?.join(',') || 'all',
      'admin',
      reason
    );

    logger.info({ keys, prefix, count, reason }, 'Cache invalidated by admin');

    res.json({
      success: true,
      count,
      message: `${count} cache entries invalidated`,
    });

  } catch (error: any) {
    logger.error({ error }, 'Error invalidating cache');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/cache/stats', authenticateAdminKey, (req: Request, res: Response) => {
  try {
    const stats = cacheService.getStats();
    res.json(stats);
  } catch (error: any) {
    logger.error({ error }, 'Error getting cache stats');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/sessions', authenticateAdminKey, (req: Request, res: Response) => {
  try {
    const sessions = sessionManager.getAllSessions();
    const sessionInfo = sessions.map(s => ({
      sessionId: s.sessionId,
      userId: s.userId,
      userEmail: s.userEmail,
      connectedAt: s.connectedAt,
      lastHeartbeat: s.lastHeartbeat,
    }));

    res.json({
      count: sessions.length,
      sessions: sessionInfo,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting sessions');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
