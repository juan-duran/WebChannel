import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { supabaseService } from '../services/supabase.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const user = (req as any).user;

  if (!user || !user.email) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const email = String(user.email).trim().toLowerCase();

  const { data: webUser, error } = await supabaseService.client
    .from('web_users')
    .select('core_user_id, email, subscription_status, trial_status, trial_expires_at')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    console.error('[api/session] error fetching web_user', { error, email });
    return res.status(500).json({ error: 'Internal error' });
  }

  if (!webUser) {
    return res.json({
      userId: user.id,
      email,
      subscription_status: null,
      trial_status: null,
      trial_expires_at: null,
    });
  }

  return res.json({
    userId: webUser.core_user_id || user.id,
    email: webUser.email || email,
    subscription_status: webUser.subscription_status,
    trial_status: webUser.trial_status,
    trial_expires_at: webUser.trial_expires_at,
  });
});

export default router;
