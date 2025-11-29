import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';

import { config, validateConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { WebSocketService } from './services/websocket.js';
import { sessionManager } from './services/session.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { requireAuth } from './middleware/requireAuth.js';

import messagesRouter from './routes/messages.js';
import adminRouter from './routes/admin.js';
import healthRouter from './routes/health.js';
import onboardingRouter from './routes/onboarding.js';
import ssoRouter from './routes/sso.js';
import logoutRouter from './routes/logout.js';
import sessionRouter from './routes/session.js';
import appRouter from './routes/app.js';
import trendsRouter from './routes/trends.js';
import trialCronRouter from './routes/trialCron.js';

async function startServer() {
  try {
    validateConfig();

    const app = express();
    const server = createServer(app);

    app.use(
      cors({
        origin: config.server.corsOrigins,
        credentials: true,
      }),
    );

    app.use(cookieParser());

    app.use(express.json({ limit: '10mb' }));

    app.use((req, _res, next) => {
      logger.debug({ method: req.method, path: req.path }, 'HTTP request');
      next();
    });

    app.use(apiRateLimit);

    // Public routes
    app.use('/health', healthRouter);
    app.use('/sso', ssoRouter);
    app.use('/logout', logoutRouter);

    // Internal cron (token header)
    app.use('/internal/trials', trialCronRouter);

    // Protected routes
    app.use('/api/session', sessionRouter);
    app.use('/api/messages', requireAuth, messagesRouter);
    app.use('/api/onboarding', requireAuth, onboardingRouter);
    app.use('/api/trends', requireAuth, trendsRouter);
    app.use('/admin', requireAuth, adminRouter);

    // SPA
    app.use('/', requireAuth, appRouter);

    // WebSocket
    const wss = new WebSocketServer({
      server,
      path: config.server.path, // "/ws"
    });
    new WebSocketService(wss);

    server.listen(config.server.port, () => {
      logger.info(
        {
          port: config.server.port,
          wsPath: config.server.path,
          corsOrigins: config.server.corsOrigins,
        },
        'WebChannel server started',
      );
    });

    const gracefulShutdown = () => {
      logger.info('Shutting down gracefully...');

      server.close(() => logger.info('HTTP server closed'));
      wss.close(() => logger.info('WebSocket server closed'));

      sessionManager.shutdown();

      setTimeout(() => {
        logger.warn('Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
