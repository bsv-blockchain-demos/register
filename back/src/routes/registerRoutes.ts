/**
 * Register Routes - Express router for registration endpoints
 */

import { Router } from 'express';
import { Db } from 'mongodb';

export const createRegisterRoutes = (db: Db): Router => {
  const router = Router();

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
