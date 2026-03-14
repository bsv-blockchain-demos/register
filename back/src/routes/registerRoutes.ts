/**
 * Register Routes - Express router for registration endpoints
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Db } from 'mongodb';

export const createRegisterRoutes = (db: Db): Router => {
  const router = Router();

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.use(limiter);

  router.post('/user', async (req, res) => {
    try {
      const usersCollection = db.collection('users');
      const result = await usersCollection.insertOne(req.body);
      res.status(201).json({
        status: 'success',
        data: { id: result.insertedId }
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        description: error.message
      });
    }
  });

  return router;
};
