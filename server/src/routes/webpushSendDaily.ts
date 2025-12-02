import { Router } from 'express';
import webpush from 'web-push';
import { supabaseService } from '../services/supabase.js';
import { coreSupabaseClient } from '../services/coreSupabase.js';

const router = Router();
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET;

const getWindowBounds = () => {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = Math.floor(now.getUTCMinutes() / 10) * 10;
  const start = `${hour}:${minute.toString().padStart(2, '0')}:00`;
  const end = `${hour}:${(minute + 9).toString().padStart(2, '0')}:59`;
  return { start, end };
};

router.post('/send-daily', async (req, res) => {
  const headerToken = req.header('X-Internal-Auth') || req.header('x-internal-auth');
  if (!INTERNAL_AUTH_SECRET || headerToken !== INTERNAL_AUTH_SECRET) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ ok: false, error: 'missing_vapid_keys' });
  }

  const { start: start_time, end: end_time } = getWindowBounds();
  const nowIso = new Date().toISOString();

  try {
    const { data: targets, error: rpcError } = await coreSupabaseClient.rpc(
      'get_web_push_targets_in_window',
      { start_time, end_time },
    );

    if (rpcError) {
      console.error('[webpush send-daily] rpc error', rpcError);
      return res.status(500).json({ ok: false, error: 'rpc_error' });
    }

    if (!targets || targets.length === 0) {
      return res.json({ ok: true, sent: 0, failed: 0, skipped: 0, removed: 0 });
    }

    webpush.setVapidDetails('mailto:push@quenty.com.br', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let removed = 0;

    const today = new Date().toISOString().slice(0, 10);

    for (const target of targets) {
      const subscription = target.subscription;
      if (!subscription || !subscription.endpoint) {
        skipped += 1;
        continue;
      }

      if (target.last_daily_sent_date === today) {
        skipped += 1;
        continue;
      }

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: '🔥 Suas 15 notícias mais quentes',
            body: 'Resumo personalizado de hoje está disponível!',
            data: { url: 'https://app.quenty.com.br/tap' },
            tag: 'daily-digest',
          }),
        );
        sent += 1;

        await supabaseService.client
          .from('web_push_tokens')
          .update({ last_daily_sent_date: today, last_seen_at: nowIso })
          .eq('subscription->>endpoint', subscription.endpoint);
      } catch (err: any) {
        failed += 1;
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          removed += 1;
          await supabaseService.client
            .from('web_push_tokens')
            .delete()
            .eq('subscription->>endpoint', subscription.endpoint);
        }
        console.error('[webpush send-daily] push failed', {
          status,
          error: err?.message,
        });
      }
    }

    console.log('[webpush send-daily] summary', {
      utcWindow: { start_time, end_time },
      sent,
      failed,
      skipped,
      removed,
      timestamp: nowIso,
    });

    return res.json({ ok: true, sent, failed, skipped, removed });
  } catch (error) {
    console.error('[webpush send-daily] unhandled error', { error });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
