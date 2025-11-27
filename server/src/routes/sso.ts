import { Router } from 'express';
import { verifyWebchannelToken } from '../auth/verifyWebchannelToken.js';
import { supabaseService } from '../services/supabase.js';
import { logger } from '../utils/logger.js';

const router = Router();

const PLANOS_REDIRECT = 'https://www.quenty.com.br/pricing-plans/list';
const INVALID_TOKEN_REDIRECT = 'https://www.quenty.com.br/puente?error=invalid_token';

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
    const { data, error } = await supabaseService.client
      .from('subscribers')
      .select('*, users(*)')
      .ilike('email', normalizedEmail)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error({ error, email: normalizedEmail }, 'Failed to fetch subscriber');
      return res.redirect(`${PLANOS_REDIRECT}?reason=db_error`);
    }

    if (!data) {
      return res.redirect(`${PLANOS_REDIRECT}?reason=not_subscriber`);
    }

    if (!data.active) {
      return res.redirect(`${PLANOS_REDIRECT}?reason=inactive`);
    }

    if (data.user_id) {
      const sessionPayload = { userId: data.user_id, email: normalizedEmail };

      res.cookie('wc_session', JSON.stringify(sessionPayload), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return res.redirect('/');
    }

    return res.redirect(`${PLANOS_REDIRECT}?reason=not_subscriber`);
  } catch (error) {
    logger.error({ error, email: normalizedEmail }, 'Unhandled error in SSO route');
    return res.redirect(`${PLANOS_REDIRECT}?reason=exception`);
  }
});

export default router;
