import type { ErrorRequestHandler, RequestHandler } from 'express';
import { log } from '../../util/log.js';

export const requestLog: RequestHandler = (req, res, next) => {
  const start = Date.now();
  log({ msg: 'http_in', method: req.method, path: req.path, contentLength: req.headers['content-length'] ?? 0 });
  res.on('finish', () => {
    log({ msg: 'http_out', method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start });
  });
  next();
};

export const bodyParseErrorLog: ErrorRequestHandler = (err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    const raw = (req as unknown as { rawBody?: string }).rawBody ?? '';
    log({
      msg: 'http_body_parse_failed',
      method: req.method,
      path: req.path,
      err: String(err.message ?? err),
      rawBody: raw.slice(0, 2000),
    });
    res.status(400).json({ error: 'invalid_json', detail: String(err.message ?? err) });
    return;
  }
  next(err);
};
