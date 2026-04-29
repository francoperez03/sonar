import type { WebSocketServer } from 'ws';
import type { LogBus } from './LogBus.js';

/**
 * Mount /logs WebSocket subscribers.
 * Each connection receives every LogEntryMsg | StatusChangeMsg emitted on logBus.
 * Inbound frames are silently ignored (Open Question 2 — broadcast-only endpoint).
 */
export function mountLogSocket(wss: WebSocketServer, deps: { logBus: LogBus }): void {
  const { logBus } = deps;
  wss.on('connection', (ws) => {
    const off = logBus.subscribe((e) => {
      ws.send(JSON.stringify(e));
    });
    ws.on('close', () => off());
    ws.on('error', () => {}); // swallow benign errors
  });
}
