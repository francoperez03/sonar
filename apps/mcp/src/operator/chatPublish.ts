/**
 * Phase 6 D-07: forward MCP tool invocations to Operator LogBus as ChatMsg
 * so the demo-ui ChatMirror renders prompt/response bubbles live.
 *
 * Failure-tolerant: a failed publish must NEVER throw out of a tool path —
 * MCP tool result correctness comes first; chat mirroring is decorative.
 */
import { ChatMsg } from '@sonar/shared';
import { log } from '../util/log.js';

export interface PublishOpts {
  operatorUrl: string;     // e.g. http://localhost:8787
  webhookSecret: string;   // bearer for /log/publish
  role: 'user' | 'assistant';
  content: string;
}

export async function publishChat(opts: PublishOpts): Promise<void> {
  const body: ChatMsg = {
    type: 'chat',
    role: opts.role,
    content: opts.content,
    timestamp: Date.now(),
  };
  // Validate before sending — fail-loud locally, fail-quiet on the wire.
  const parsed = ChatMsg.safeParse(body);
  if (!parsed.success) {
    log({ msg: 'chatPublish_invalid_local', level: 'warn' });
    return;
  }
  // Empty secret disables publishing (e.g. dev environments without the env set).
  if (!opts.webhookSecret) {
    log({ msg: 'chatPublish_skipped_no_secret', level: 'warn' });
    return;
  }
  try {
    const r = await fetch(`${opts.operatorUrl}/log/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.webhookSecret}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      log({ msg: 'chatPublish_non_ok', status: r.status, level: 'warn' });
    }
  } catch (err) {
    log({ msg: 'chatPublish_failed', err: String(err), level: 'warn' });
  }
}
