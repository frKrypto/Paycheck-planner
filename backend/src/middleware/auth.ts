import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth';

export interface AuthRequest extends Request {
  userId?: number;
}

/**
 * Auth middleware — extracts and verifies JWT from the Authorization header.
 * Attaches userId to the request. Returns 401 if token is missing or invalid.
 */
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
