import { QuarkIdRequest } from './common';

declare global {
  namespace Express {
    interface Request extends QuarkIdRequest {}
  }
}