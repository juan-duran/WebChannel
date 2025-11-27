import { RequestHandler } from 'express';

declare global {
  namespace Express {
    interface Request {
      cookies: Record<string, string>;
    }
  }
}

declare function cookieParser(): RequestHandler;

export = cookieParser;
