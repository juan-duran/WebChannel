import { Router } from 'express';
import { supabaseService } from '../services/supabase.js';
import { coreSupabaseClient } from '../services/coreSupabase.js';

const router = Router();
const CRON_TOKEN = process.env.TRIAL_CRON_TOKEN;

router.post('/expire', async (req, res) => {
  const headerToken = req.header('x-cron-token');
  if (!CRON_TOKEN || headerToken !== CRON_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const nowIso = new Date().toISOString();

  const { data: candidates, error: fetchErr } = await supabaseService.client
    .from('web_users')
    .select('core_user_id')
    .eq('trial_status', 'active')
    .neq('subscription_status', 'active')
    .lt('trial_expires_at', nowIso);

  if (fetchErr) {
    console.error('[trialCron] fetch web_users error', fetchErr);
    return res.status(500).json({ error: 'fetch_failed' });
  }

  const coreUserIds = (candidates || [])
    .map((u) => u.core_user_id)
    .filter((id): id is string => Boolean(id));

  if (!coreUserIds.length) {
    return res.json({ ok: true, expiredCount: 0 });
  }

  const { error: updWebErr } = await supabaseService.client
    .from('web_users')
    .update({
      trial_status: 'expired',
    })
    .in('core_user_id', coreUserIds);

  if (updWebErr) {
    console.error('[trialCron] update web_users error', updWebErr);
  }

  const { error: updCoreErr } = await coreSupabaseClient
    .from('subscribers')
    .update({ active: false })
    .in('user_id', coreUserIds);

  if (updCoreErr) {
    console.error('[trialCron] update CORE.subscribers error', updCoreErr);
  }

  return res.json({
    ok: true,
    expiredCount: coreUserIds.length,
  });
});

export default router;
