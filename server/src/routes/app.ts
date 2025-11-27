import express from 'express';
import path from 'path';

const appRouter = express.Router();
const distPath = path.join(process.cwd(), 'dist');

appRouter.use(express.static(distPath));

appRouter.get(/.*/, (_req, res) => {
  return res.sendFile(path.join(distPath, 'index.html'));
});

export default appRouter;
