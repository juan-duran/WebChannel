import { Router } from 'express';
import webpush from 'web-push';
import { supabaseService } from '../services/supabase.js';
import { coreSupabaseClient } from '../services/coreSupabase.js';

const router = Router();

type RpcRow = { email: string | null; preferred_send_time: string | null };
type WebUser = { id: string; email: string | null };
type WebPushToken = { id: string; user_id: string; subscription: any };

router.post('/send-daily', async (req, res) => {
  const token = req.header('X-Internal-Auth');
  if (!token || token !== process.env.INTERNAL_AUTH_SECRET) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ ok: false, error: 'missing_vapid_keys' });
  }

  const now = new Date();
  const hour = now.getUTCHours();
  const minuteBlock = Math.floor(now.getUTCMinutes() / 10) * 10;

  const startTime = `${hour.toString().padStart(2, '0')}:${minuteBlock
    .toString()
    .padStart(2, '0')}:00`;

  const endMinute = minuteBlock + 9;
  const endTime = `${hour.toString().padStart(2, '0')}:${endMinute
    .toString()
    .padStart(2, '0')}:59`;

  console.log('[webpush send-daily] window', { startTime, endTime });

  try {
    const { data: rows, error: rpcError } = await coreSupabaseClient.rpc(
      'get_push_user_emails_in_window',
      { start_time: startTime, end_time: endTime },
    );

    if (rpcError) {
      console.error('[webpush send-daily] rpc error', rpcError);
      return res.status(500).json({ ok: false, error: 'rpc_error' });
    }

    const rpcRows: RpcRow[] = (rows || []) as RpcRow[];

    const emails = Array.from(
      new Set(
        rpcRows
          .map((r: RpcRow) => r.email?.toLowerCase())
          .filter((email: string | null | undefined): email is string => Boolean(email)),
      ),
    );

    if (emails.length === 0) {
      console.log('[webpush send-daily] no emails in window');
      return res.json({ ok: true, sent: 0, failed: 0, skipped: 0, removed: 0 });
    }

    const { data: webUsers, error: wuErr } = await supabaseService.client
      .from('web_users')
      .select('id, email')
      .in('email', emails);

    if (wuErr) {
      console.error('[webpush send-daily] web_users error', wuErr);
      return res.status(500).json({ ok: false, error: 'web_users_error' });
    }

    const emailToUserIds = new Map<string, string[]>();
    const allUserIds = new Set<string>();

    for (const user of (webUsers || []) as WebUser[]) {
      const key = (user.email || '').toLowerCase();
      if (!key) continue;
      if (!emailToUserIds.has(key)) {
        emailToUserIds.set(key, []);
      }
      emailToUserIds.get(key)!.push(user.id);
      allUserIds.add(user.id);
    }

    const allUserIdsArray = Array.from(allUserIds);

    const userIdToTokens = new Map<string, WebPushToken[]>();
    if (allUserIdsArray.length > 0) {
      const { data: tokens, error: tokErr } = await supabaseService.client
        .from('web_push_tokens')
        .select('id, user_id, subscription')
        .in('user_id', allUserIdsArray);

      if (tokErr) {
        console.error('[webpush send-daily] tokens error', tokErr);
        return res.status(500).json({ ok: false, error: 'tokens_error' });
      }

      for (const token of (tokens || []) as WebPushToken[]) {
        if (!userIdToTokens.has(token.user_id)) {
          userIdToTokens.set(token.user_id, []);
        }
        userIdToTokens.get(token.user_id)!.push(token);
      }
    }

    webpush.setVapidDetails('mailto:suporte@quenty.com.br', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let removed = 0;

    for (const row of rows || []) {
      const emailRaw = row.email;
      const email = emailRaw?.toLowerCase();
      if (!email) {
        skipped += 1;
        continue;
      }

      const userIds = emailToUserIds.get(email);
      if (!userIds || userIds.length === 0) {
        console.log('[webpush send-daily] no web_user for email', emailRaw);
        skipped += 1;
        continue;
      }

      const userTokens: WebPushToken[] = [];
      for (const uid of userIds) {
        const list = userIdToTokens.get(uid);
        if (list?.length) {
          userTokens.push(...list);
        }
      }

      if (userTokens.length === 0) {
        console.log('[webpush send-daily] no tokens for email', emailRaw);
        skipped += 1;
        continue;
      }

      let anySuccessForThisEmail = false;

      for (const tok of userTokens) {
        try {
          await webpush.sendNotification(
            tok.subscription,
            JSON.stringify({
              title: '🔥 Seu resumo de hoje chegou!',
              body: 'Veja as 15 notícias mais quentes do seu dia.',
              url: 'https://app.quenty.com.br/tap?src=webpush_daily',
              data: { url: 'https://app.quenty.com.br/tap?src=webpush_daily' },
            }),
          );

          sent += 1;
          anySuccessForThisEmail = true;

          await supabaseService.client
            .from('web_push_tokens')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', tok.id);
        } catch (err: any) {
          failed += 1;
          const status = err?.statusCode || err?.status;
          console.error('[webpush send-daily] push error', {
            tokenId: tok.id,
            status,
            msg: String(err),
          });

          if (status === 404 || status === 410) {
            removed += 1;
            await supabaseService.client.from('web_push_tokens').delete().eq('id', tok.id);
          }
        }
      }

      if (anySuccessForThisEmail) {
        const today = new Date().toISOString().slice(0, 10);
        const { error: updErr } = await coreSupabaseClient
          .from('subscribers')
          .update({ last_webpush_sent_date: today })
          .eq('email', emailRaw);

        if (updErr) {
          console.error('[webpush send-daily] update last_webpush_sent_date error', {
            email: emailRaw,
            error: updErr,
          });
        }
      }
    }

    console.log('[webpush send-daily] summary', {
      sent,
      failed,
      skipped,
      removed,
    });

    return res.json({ ok: true, sent, failed, skipped, removed });
  } catch (error) {
    console.error('[webpush send-daily] unhandled error', { error });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
