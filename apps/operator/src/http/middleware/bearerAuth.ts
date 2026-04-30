/**
 * Bearer-token auth for the /rotation/* surface. Per Phase 5 CONTEXT D-18.
 * Constant-time compare via crypto.timingSafeEqual. 401 on miss.
 */
import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

export function bearerAuth(secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers['authorization'];
    if (typeof header !== 'string' || header.length !== expected.length) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const got = Buffer.from(header, 'utf8');
    if (!timingSafeEqual(got, expected)) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  };
}
