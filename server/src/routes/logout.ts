import { Router } from 'express';

const router = Router();
const WC_COOKIE = 'wc_session';
const WIX_ACCOUNT_URL = 'https://www.quenty.com.br/account-settings';

router.get('/', (req, res) => {
  res.clearCookie(WC_COOKIE, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return res.redirect(WIX_ACCOUNT_URL);
});

export default router;
