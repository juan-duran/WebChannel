import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export function isAdminUser(req: Request): boolean {
  const email = req.user?.email?.toLowerCase?.();
  if (!email) return false;
  return config.security.adminEmails.includes(email);
}

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
  // Allow authenticated admin users (email allowlist) without requiring the header key.
  if (isAdminUser(req)) {
    return next();
  }

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
