import { Router } from 'express';
import { supabaseService } from '../services/supabase.js';
import webpush from 'web-push';

const router = Router();

router.get('/status', async (req, res) => {
  const user = (req as any).user;
  if (!user?.email) {
    return res.status(401).json({ ok: false, error: 'unauthenticated' });
  }

  try {
    const { data: webUser, error: userErr } = await supabaseService.client
      .from('web_users')
      .select('id')
      .ilike('email', user.email)
      .single();

    if (userErr) {
      console.error('[webpush status] user lookup error', { error: userErr, email: user.email });
      return res.status(500).json({ ok: false, error: 'user_lookup_failed' });
    }

    if (!webUser?.id) {
      return res.json({ ok: true, enabled: false });
    }

    const { count, error: tokensErr } = await supabaseService.client
      .from('web_push_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', webUser.id);

    if (tokensErr) {
      console.error('[webpush status] tokens count error', { error: tokensErr, userId: webUser.id });
      return res.status(500).json({ ok: false, error: 'tokens_error' });
    }

    return res.json({ ok: true, enabled: Boolean((count ?? 0) > 0) });
  } catch (error) {
    console.error('[webpush status] unexpected error', { error, email: user.email });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

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

router.post('/send-test', async (req, res) => {
  const user = (req as any).user;
  if (!user?.email) {
    return res.status(401).json({ ok: false, error: 'unauthenticated' });
  }

  const { title, body, url } = req.body || {};
  if (!title || !body || !url) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ ok: false, error: 'missing_vapid_keys' });
  }

  try {
    const { data: webUser, error: userErr } = await supabaseService.client
      .from('web_users')
      .select('id')
      .ilike('email', user.email)
      .single();

    if (userErr || !webUser?.id) {
      return res.status(404).json({ ok: false, error: 'user_not_found' });
    }

    const { data: tokens, error: tokensErr } = await supabaseService.client
      .from('web_push_tokens')
      .select('id, subscription')
      .eq('user_id', webUser.id);

    if (tokensErr) {
      throw tokensErr;
    }

    if (!tokens || tokens.length === 0) {
      return res.json({ ok: true, sent: 0, failed: 0 });
    }

    webpush.setVapidDetails(`mailto:${user.email}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    let sent = 0;
    let failed = 0;

    for (const token of tokens) {
      try {
        await webpush.sendNotification(
          token.subscription as any,
          JSON.stringify({ title, body, url }),
        );
        sent += 1;
      } catch (err: any) {
        failed += 1;
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          await supabaseService.client
            .from('web_push_tokens')
            .delete()
            .eq('id', token.id);
        }
        console.error('Push send failed', { tokenId: token.id, status, error: err?.message });
      }
    }

    return res.json({ ok: true, sent, failed });
  } catch (error) {
    console.error('Failed to send test push:', { error, userEmail: user.email });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
