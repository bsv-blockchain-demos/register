/**
 * Status Routes - Express router for status endpoints
 */

import { Router } from 'express';
import { Db } from 'mongodb';

export const createStatusRoutes = (db: Db): Router => {
  const router = Router();

  router.get('/health', async (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  return router;
};
