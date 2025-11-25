import { Router, Request, Response, NextFunction } from 'express';
import { supabaseService } from '../services/supabase.js';
import { coreSupabaseService, OnboardingPayload } from '../services/coreSupabase.js';
import { logger } from '../utils/logger.js';

interface AuthenticatedRequest extends Request {
  authUser?: {
    userId: string;
    email: string;
  };
}

const onboardingRouter = Router();

async function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const authUser = await supabaseService.verifyAuthToken(token);

  if (!authUser || !authUser.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.authUser = authUser;
  next();
}

onboardingRouter.use(authenticateUser);

onboardingRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const email = req.authUser?.email;
  const requestId = req.headers['x-request-id'];

  try {
    
    if (!email) {
      return res.status(400).json({ error: 'Missing user email' });
    }

    const profile = await coreSupabaseService.getOnboardingProfile(email);
    return res.json({ data: profile });
  } catch (error) {
    logger.error(
      {
        email,
        requestId,
        supabaseError: error instanceof Error ? error.message : String(error),
        error,
      },
      'Failed to load onboarding data',
    );

    return res.status(500).json({ error: 'Failed to load onboarding data' });
  }
});

onboardingRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const email = req.authUser?.email;
  const requestId = req.headers['x-request-id'];
  const payload = req.body?.payload as OnboardingPayload | undefined;

  try {

    if (!email) {
      return res.status(400).json({ error: 'Missing user email' });
    }

    if (!payload) {
      return res.status(400).json({ error: 'Missing onboarding payload' });
    }

    await coreSupabaseService.updateOnboardingProfile(email, payload);
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error(
      {
        email,
        requestId,
        supabaseError: error instanceof Error ? error.message : String(error),
        error,
      },
      'Failed to update onboarding data',
    );

    return res.status(500).json({ error: 'Failed to update onboarding data' });
  }
});

export default onboardingRouter;
