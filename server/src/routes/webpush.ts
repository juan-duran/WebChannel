import { Router } from 'express';
import { supabaseService } from '../services/supabase.js';

const router = Router();

router.post('/subscribe', async (req, res) => {
  const user = (req as any).user;
  if (!user?.id || !user?.email) {
    return res.status(401).json({ ok: false, error: 'unauthenticated' });
  }

  const subscription = req.body?.subscription;
  const endpoint = subscription?.endpoint;

  if (!endpoint) {
    return res.status(400).json({ ok: false, error: 'missing subscription.endpoint' });
  }

  try {
    await supabaseService.client
      .from('web_push_tokens')
      .delete()
      .eq('subscription->>endpoint', endpoint);

    const { error } = await supabaseService.client
      .from('web_push_tokens')
      .insert({
        user_id: user.id,
        subscription,
        last_seen_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('[webpush] subscribe error', error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
