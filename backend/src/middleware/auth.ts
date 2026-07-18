import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
}

/**
 * Placeholder auth middleware.
 * Extracts JWT from the Authorization header and attaches userId to the request.
 * Currently does NOT reject unauthenticated requests — passes through if no token.
 */
export function authMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const secret = process.env.JWT_SECRET || 'dev-secret';
      const decoded = jwt.verify(token, secret) as { userId: number };
      req.userId = decoded.userId;
    } catch {
      // Token invalid — leave userId undefined
      // Future: reject with 401 once auth is enforced
    }
  }

  next();
}
