import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types/common';

/**
 * Validation middleware for API requests
 */
export class ValidationMiddleware {
  /**
   * Validate request body has required fields
   */
  static requireFields(fields: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const missing = fields.filter(field => !req.body[field]);
      
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`
        } as ApiError);
      }
      
      next();
    };
  }

  /**
   * Validate request parameters
   */
  static requireParams(params: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const missing = params.filter(param => !req.params[param]);
      
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required parameters: ${missing.join(', ')}`
        } as ApiError);
      }
      
      next();
    };
  }

  /**
   * Validate email format
   */
  static validateEmail(field: string = 'email') {
    return (req: Request, res: Response, next: NextFunction) => {
      const email = req.body[field];
      
      if (email && !ValidationMiddleware.isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: `Invalid ${field} format`
        } as ApiError);
      }
      
      next();
    };
  }

  /**
   * Validate actor type
   */
  static validateActorType() {
    return (req: Request, res: Response, next: NextFunction) => {
      const { type } = req.body;
      const validTypes = ['patient', 'doctor', 'pharmacy', 'insurance'];
      
      if (type && !validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid actor type. Must be one of: ${validTypes.join(', ')}`
        } as ApiError);
      }
      
      next();
    };
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination() {
    return (req: Request, res: Response, next: NextFunction) => {
      const { limit, offset } = req.query;
      
      if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 1000)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid limit parameter. Must be a number between 1 and 1000'
        } as ApiError);
      }
      
      if (offset && (isNaN(Number(offset)) || Number(offset) < 0)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid offset parameter. Must be a non-negative number'
        } as ApiError);
      }
      
      next();
    };
  }

  /**
   * Check if service is available
   */
  static requireService(serviceName: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const service = req[serviceName];
      
      if (!service) {
        return res.status(503).json({
          success: false,
          error: `${serviceName} not available`
        } as ApiError);
      }
      
      next();
    };
  }

  // Helper methods
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Error handling middleware
 */
export class ErrorMiddleware {
  /**
   * Global error handler
   */
  static handleErrors() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('[ErrorMiddleware] Unhandled error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      } as ApiError);
    };
  }

  /**
   * 404 handler
   */
  static handleNotFound() {
    return (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      } as ApiError);
    };
  }

  /**
   * Async error wrapper
   */
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

/**
 * Request logging middleware
 */
export class LoggingMiddleware {
  /**
   * Log API requests
   */
  static logRequests() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      
      if (req.body && Object.keys(req.body).length > 0) {
        console.log(`[${new Date().toISOString()}] Request body:`, JSON.stringify(req.body, null, 2));
      }
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
      });
      
      next();
    };
  }
}