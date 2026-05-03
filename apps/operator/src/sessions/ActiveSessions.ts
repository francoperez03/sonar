import type { WebSocket } from 'ws';

/**
 * Map<runtimeId, WebSocket> with automatic cleanup on socket close.
 * Per RESEARCH Pattern 7 + Pitfall 5 (race on reconnect).
 */
export class ActiveSessions {
  private map = new Map<string, WebSocket>();

  bind(runtimeId: string, ws: WebSocket): void {
    this.map.set(runtimeId, ws);
    ws.once('close', () => {
      if (this.map.get(runtimeId) === ws) this.map.delete(runtimeId);
    });
  }

  /** Drop the binding for a runtimeId only if the currently bound socket
   * matches `ws` (avoids racing with a new bind that already replaced it). */
  unbind(runtimeId: string, ws: WebSocket): void {
    if (this.map.get(runtimeId) === ws) this.map.delete(runtimeId);
  }

  get(runtimeId: string): WebSocket | undefined {
    return this.map.get(runtimeId);
  }

  has(runtimeId: string): boolean {
    return this.map.has(runtimeId);
  }

  forceClose(runtimeId: string, code = 4401, reason = 'revoked'): void {
    const ws = this.map.get(runtimeId);
    if (ws) ws.close(code, reason);
  }
}
