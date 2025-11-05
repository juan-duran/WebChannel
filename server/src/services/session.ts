import { WebSocket } from 'ws';
import { SessionData } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { generateSessionId } from '../utils/crypto.js';

export class SessionManager {
  private sessions: Map<string, SessionData>;
  private userSessions: Map<string, Set<string>>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.sessions = new Map();
    this.userSessions = new Map();
    this.cleanupInterval = null;

    this.startCleanupTask();
    logger.info('Session manager initialized');
  }

  createSession(ws: WebSocket, userId: string, userEmail: string, metadata?: Record<string, any>): SessionData {
    const sessionId = generateSessionId();
    const now = new Date();

    const session: SessionData = {
      sessionId,
      userId,
      userEmail,
      ws,
      connectedAt: now,
      lastHeartbeat: now,
      metadata,
    };

    this.sessions.set(sessionId, session);

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    logger.info({ sessionId, userId, userEmail }, 'Session created');
    return session;
  }

  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionsByUserId(userId: string): SessionData[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter((s): s is SessionData => s !== undefined);
  }

  getSessionByEmail(email: string): SessionData | undefined {
    for (const session of this.sessions.values()) {
      if (session.userEmail === email) {
        return session;
      }
    }
    return undefined;
  }

  updateHeartbeat(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastHeartbeat = new Date();
      logger.debug({ sessionId }, 'Heartbeat updated');
      return true;
    }
    return false;
  }

  removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);

    const userSessionIds = this.userSessions.get(session.userId);
    if (userSessionIds) {
      userSessionIds.delete(sessionId);
      if (userSessionIds.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    logger.info({ sessionId, userId: session.userId }, 'Session removed');
    return true;
  }

  getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  private startCleanupTask() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, 60000);
  }

  private cleanupStaleSessions() {
    const now = Date.now();
    const timeout = config.session.sessionTimeout;
    let removed = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastHeartbeatTime = session.lastHeartbeat.getTime();
      if (now - lastHeartbeatTime > timeout) {
        try {
          session.ws.close(1000, 'Session timeout');
        } catch (error) {
          logger.warn({ sessionId, error }, 'Error closing stale WebSocket');
        }
        this.removeSession(sessionId);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info({ removed }, 'Stale sessions cleaned up');
    }
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const session of this.sessions.values()) {
      try {
        session.ws.close(1000, 'Server shutdown');
      } catch (error) {
        logger.warn({ sessionId: session.sessionId, error }, 'Error closing WebSocket during shutdown');
      }
    }

    this.sessions.clear();
    this.userSessions.clear();
    logger.info('Session manager shutdown complete');
  }
}

export const sessionManager = new SessionManager();
