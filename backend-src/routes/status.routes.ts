import { Router } from 'express';

export const statusRoutes = Router();

statusRoutes.get('/status', (_req, res) => {
  res.json({ ok: true, service: 'pizzaria-api' });
});
