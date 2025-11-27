import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const user = (req as any).user;

  return res.json({
    userId: user.id,
    email: user.email,
  });
});

export default router;
