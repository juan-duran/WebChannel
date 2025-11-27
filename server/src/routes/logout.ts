import { Router } from 'express';

const router = Router();

const LOGOUT_REDIRECT = 'https://www.quenty.com.br/puente';

router.get('/', (_req, res) => {
  res.clearCookie('wc_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return res.redirect(LOGOUT_REDIRECT);
});

export default router;
