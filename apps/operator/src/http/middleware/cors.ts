import type { Request, Response, NextFunction } from 'express';

const ALLOWED_ORIGINS = new Set<string>([
  'https://sonar-demo-ui.vercel.app',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
]);

/**
 * Narrow CORS middleware for the agent endpoint.
 * Echoes the request origin only if it is on the allowlist; anything else
 * gets no Access-Control-* headers and the browser will block.
 */
export function agentCors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
