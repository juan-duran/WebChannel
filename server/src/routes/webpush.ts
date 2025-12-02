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
    const { data: webUser, error: userErr } = await supabaseService.client
      .from('web_users')
      .select('id')
      .ilike('email', user.email)
      .single();

    if (userErr || !webUser?.id) {
      return res.status(404).json({ ok: false, error: 'user_not_found_in_web_users' });
    }

    await supabaseService.client
      .from('web_push_tokens')
      .delete()
      .eq('subscription->>endpoint', endpoint);

    const { error } = await supabaseService.client
      .from('web_push_tokens')
      .insert({
        user_id: webUser.id,
        subscription,
        last_seen_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to save subscription:', {
      error,
      userId: user?.id,
      subscription,
    });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.delete('/unsubscribe', async (req, res) => {
  const user = (req as any).user;
  if (!user?.email) {
    return res.status(401).json({ ok: false, error: 'unauthenticated' });
  }

  const endpoint = req.body?.endpoint;
  if (!endpoint) {
    return res.status(400).json({ ok: false, error: 'missing_endpoint' });
  }

  try {
    const { data: webUser, error: userErr } = await supabaseService.client
      .from('web_users')
      .select('id')
      .ilike('email', user.email)
      .single();

    if (userErr || !webUser?.id) {
      return res.status(404).json({ ok: false, error: 'user_not_found_in_web_users' });
    }

    await supabaseService.client
      .from('web_push_tokens')
      .delete()
      .eq('user_id', webUser.id)
      .eq('subscription->>endpoint', endpoint);

    console.log('Unsubscribed push endpoint:', { endpoint, userId: webUser.id });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to unsubscribe push endpoint:', {
      error,
      endpoint,
      userEmail: user.email,
    });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
