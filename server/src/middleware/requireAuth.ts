import { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
    };
  }
}

const REDIRECT_URL = 'https://www.quenty.com.br/puente';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionCookie = req.cookies?.wc_session;

  if (!sessionCookie) {
    return res.redirect(REDIRECT_URL);
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(sessionCookie);
  } catch (error) {
    res.clearCookie('wc_session', { path: '/' });
    return res.redirect(REDIRECT_URL);
  }

  const { userId, email } = sessionData ?? {};

  if (!userId || !email) {
    res.clearCookie('wc_session', { path: '/' });
    return res.redirect(REDIRECT_URL);
  }

  req.user = { id: userId, email };

  return next();
}
