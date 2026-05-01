/**
 * POST /log/publish — Phase 6 D-07 chat-event ingestion.
 *
 * Bearer-auth'd LogBus producer for ChatMsg payloads. MCP server (apps/mcp)
 * calls this when any tool runs so the demo-ui can render the chat mirror
 * via the same /logs WS broadcast that already carries log_entry / status_change.
 *
 * Request body: ChatMsg (validated against shared zod schema; trust-boundary
 *               check per Phase 2 D-09).
 * Response: 200 { status: 'published' }
 *           400 { error: 'invalid_request' }
 */
import type { Request, Response } from 'express';
import { ChatMsg } from '@sonar/shared';
import type { LogBus } from '../../../log/LogBus.js';

interface Deps {
  logBus: LogBus;
}

export function logPublishRoute(deps: Deps) {
  return (req: Request, res: Response): void => {
    const parsed = ChatMsg.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    deps.logBus.emitEvent(parsed.data);
    res.status(200).json({ status: 'published' });
  };
}
