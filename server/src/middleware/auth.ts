import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({ path: req.path }, 'Missing or invalid authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  if (token !== config.n8n.apiKey) {
    logger.warn({ path: req.path }, 'Invalid API key');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

export function authenticateAdminKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({ path: req.path }, 'Missing or invalid authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  if (token !== config.security.adminApiKey) {
    logger.warn({ path: req.path }, 'Invalid admin API key');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
