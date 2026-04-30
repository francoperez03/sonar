import WebSocket from 'ws';
import { LogEntryMsg, StatusChangeMsg } from '@sonar/shared';
import type { RingBuffer } from '../buffer/RingBuffer.js';
import { log } from '../util/log.js';

const LogEvent = LogEntryMsg.or(StatusChangeMsg);

/**
 * Open a WS to the operator /logs endpoint, parse frames with the locked
 * Phase 2 schemas, and push validated events into the supplied RingBuffer.
 *
 * Reconnect strategy (RESEARCH Pattern 3, Pitfall 5):
 *   - Backoff doubles 1s → 30s on each consecutive failure.
 *   - Backoff resets to 1s on a successful 'open'.
 *   - Reconnect is driven ONLY by the 'close' event ('error' is swallowed because
 *     it is always followed by 'close' — listening to both would double-fire).
 *   - stop() flips an internal flag; any in-flight reconnect bails out and
 *     the underlying socket is closed cleanly with code 1000.
 */
export function connectLogs(opts: { url: string; buffer: RingBuffer }): { stop: () => void } {
  let backoff = 1_000;
  let stopped = false;
  let ws: WebSocket | null = null;

  function open() {
    if (stopped) return;
    ws = new WebSocket(opts.url);

    ws.on('open', () => {
      backoff = 1_000;
      log({ msg: 'logs_connected', url: opts.url });
    });

    ws.on('message', (raw) => {
      try {
        const ev = LogEvent.parse(JSON.parse(raw.toString()));
        opts.buffer.push(ev);
      } catch {
        // Ignore malformed frame; do NOT close — operator only sends valid ones.
      }
    });

    const reconnect = () => {
      if (stopped) return;
      setTimeout(() => {
        backoff = Math.min(backoff * 2, 30_000);
        open();
      }, backoff);
    };

    ws.on('close', reconnect);
    ws.on('error', () => {
      // 'close' follows; swallow per Pitfall 5.
    });
  }

  open();

  return {
    stop: () => {
      stopped = true;
      ws?.close(1000, 'shutdown');
    },
  };
}
