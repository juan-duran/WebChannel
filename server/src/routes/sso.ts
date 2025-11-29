import { Router } from 'express';
import { verifyWebchannelToken } from '../auth/verifyWebchannelToken.js';
import { coreSupabaseClient } from '../services/coreSupabase.js';
import { supabaseService } from '../services/supabase.js';
import { logger } from '../utils/logger.js';

const router = Router();

const PLANOS_REDIRECT = 'https://www.quenty.com.br/pricing-plans/list';
const INVALID_TOKEN_REDIRECT = 'https://www.quenty.com.br/puente?error=invalid_token';

async function ensureCoreSubscriberAndWebUser(normalizedEmail: string) {
  const { data: existingSub, error: findSubError } = await coreSupabaseClient
    .from('subscribers')
    .select('id, user_id, active, email')
    .ilike('email', normalizedEmail)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findSubError) {
    throw findSubError;
  }

  let coreUserId = existingSub?.user_id ?? null;

  if (!coreUserId) {
    const { data: newUser, error: userError } = await coreSupabaseClient
      .from('users')
      .insert({
        profile_json: { email: normalizedEmail, source: 'web' },
      })
      .select('id')
      .single();

    if (userError) {
      throw userError;
    }

    coreUserId = newUser?.id ?? null;
  }

  if (!coreUserId) {
    throw new Error('Failed to resolve core user id');
  }

  let subscriber = existingSub ?? null;
  const isNewSubscriber = !subscriber;

  if (!subscriber) {
    const { data: newSub, error: subError } = await coreSupabaseClient
      .from('subscribers')
      .insert({
        user_id: coreUserId,
        phone_jid: 'web:' + normalizedEmail,
        active: true,
        email: normalizedEmail,
      })
      .select('id, user_id, active, email')
      .single();

    if (subError) {
      throw subError;
    }

    subscriber = newSub ?? null;
  }

  // Do not reactivate here. Let caller decide redirect for inactive.
  if (subscriber && subscriber.active === false) {
    return { subscriber, coreUserId, webUser: null, blocked: true as const };
  }

  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: webUser, error: webUserError } = await supabaseService.client
    .from('web_users')
    .upsert(
      isNewSubscriber
        ? {
            email: normalizedEmail,
            core_user_id: coreUserId,
            subscription_status: 'trial',
            trial_status: 'active',
            trial_expires_at: threeDaysFromNow,
          }
        : {
            email: normalizedEmail,
            core_user_id: coreUserId,
          },
      { onConflict: 'email' },
    )
    .select('*')
    .single();

  if (webUserError) {
    throw webUserError;
  }

  return { subscriber, coreUserId, webUser, blocked: false as const };
}

router.get('/', async (req, res) => {
  const { token } = req.query;

  if (typeof token !== 'string') {
    return res.redirect(PLANOS_REDIRECT);
  }

  let payload: ReturnType<typeof verifyWebchannelToken>;

  try {
    payload = verifyWebchannelToken(token);
  } catch (error) {
    logger.error({ error }, 'Failed to verify Webchannel token');
    return res.redirect(INVALID_TOKEN_REDIRECT);
  }

  if (!payload) {
    return res.redirect(INVALID_TOKEN_REDIRECT);
  }

  const normalizedEmail = payload.email.trim().toLowerCase();

  try {
    const { coreUserId, subscriber, blocked } = await ensureCoreSubscriberAndWebUser(normalizedEmail);

    if (blocked || (subscriber && subscriber.active === false)) {
      return res.redirect(`${PLANOS_REDIRECT}?reason=inactive`);
    }

    const sessionPayload = { userId: coreUserId, email: normalizedEmail };

    res.cookie('wc_session', JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.redirect('/');
  } catch (error) {
    logger.error({ error, email: normalizedEmail }, 'Unhandled error in SSO route');
    return res.redirect(`${PLANOS_REDIRECT}?reason=exception`);
  }
});

export default router;
