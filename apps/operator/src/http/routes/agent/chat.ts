import type { Request, Response } from 'express';
import { runAgent, type AgentEvent } from '../../../agent/runAgent.js';
import type { AgentToolsCtx } from '../../../agent/tools.js';
import type { LogBus } from '../../../log/LogBus.js';

export interface AgentChatDeps {
  apiKey: string;
  toolsCtx: AgentToolsCtx;
  logBus: LogBus;
}

/**
 * POST /agent/chat — body: { prompt: string }
 * Response: text/event-stream of AgentEvent JSON payloads.
 */
export function agentChatRoute(deps: AgentChatDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json({ error: 'invalid_request', message: 'prompt required' });
      return;
    }
    if (!deps.apiKey) {
      res.status(500).json({ error: 'agent_not_configured', message: 'ANTHROPIC_API_KEY missing' });
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const write = (ev: AgentEvent): void => {
      res.write(`event: ${ev.type}\n`);
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    };

    const heartbeat = setInterval(() => res.write(': hb\n\n'), 15_000);

    try {
      for await (const ev of runAgent({
        apiKey: deps.apiKey,
        prompt,
        toolsCtx: deps.toolsCtx,
        logBus: deps.logBus,
      })) {
        if (res.writableEnded) break;
        write(ev);
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'unknown';
      write({ type: 'done', reason: 'error', detail });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  };
}
