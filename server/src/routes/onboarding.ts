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

type ValidationResult = { isValid: true } | { isValid: false; errors: string[] };

type SupabaseError = Error & {
  status?: number;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function isSupabaseError(error: unknown): error is SupabaseError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

function validateOnboardingPayload(payload: unknown): ValidationResult {
  if (typeof payload !== 'object' || payload === null) {
    return { isValid: false, errors: ['Payload must be an object'] };
  }

  const onboardingPayload = payload as Partial<OnboardingPayload>;
  const errors: string[] = [];

  if (!onboardingPayload.handle || typeof onboardingPayload.handle !== 'string' || !onboardingPayload.handle.trim()) {
    errors.push('handle is required and must be a non-empty string');
  }

  const preferredSendTime = onboardingPayload.preferred_send_time;
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (preferredSendTime !== null && preferredSendTime !== undefined) {
    if (typeof preferredSendTime !== 'string' || !timePattern.test(preferredSendTime)) {
      errors.push('preferred_send_time must match HH:MM in 24-hour format when provided');
    }
  }

  if (!Array.isArray(onboardingPayload.moral_values)) {
    errors.push('moral_values is required and must be an array of strings');
  } else if (!onboardingPayload.moral_values.every((value) => typeof value === 'string')) {
    errors.push('moral_values must only contain strings');
  }

  const requiredNullableStringFields: (keyof OnboardingPayload)[] = [
    'employment_status',
    'education_level',
    'family_status',
    'living_with',
    'income_bracket',
    'religion',
  ];

  requiredNullableStringFields.forEach((field) => {
    const value = onboardingPayload[field];
    if (value === undefined) {
      errors.push(`${field} is required and must be provided, even if null`);
    } else if (value !== null && typeof value !== 'string') {
      errors.push(`${field} must be a string or null`);
    }
  });

  return errors.length ? { isValid: false, errors } : { isValid: true };
}

export { validateOnboardingPayload };

async function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Prefer user data set by cookie-based auth middleware
  if (req.user?.email) {
    req.authUser = {
      userId: req.user.id,
      email: req.user.email,
    };
    return next();
  }

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

    const validationResult = validateOnboardingPayload(payload);
    if (!validationResult.isValid) {
      return res.status(400).json({ error: 'Invalid onboarding payload', details: validationResult.errors });
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

    if (isSupabaseError(error)) {
      const statusCode =
        error.status && error.status >= 400 && error.status < 500
          ? error.status
          : error.code || error.details || error.hint
            ? 400
            : 500;

      return res.status(statusCode).json({
        error: 'Failed to update onboarding data',
        message: error.message,
        details: error.details ?? undefined,
        code: error.code ?? undefined,
      });
    }

    return res.status(500).json({ error: 'Failed to update onboarding data' });
  }
});

export default onboardingRouter;
