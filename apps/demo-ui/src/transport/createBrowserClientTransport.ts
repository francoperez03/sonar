import type { ITransport, Unsubscribe, Message } from "@sonar/shared";
import { Message as MessageSchema } from "@sonar/shared";

export interface BrowserClientOpts {
  url: string;
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
}

/**
 * Browser ITransport adapter — native WebSocket with exponential reconnect
 * (1s → 30s capped). Mirrors apps/runtime/src/transport/createClientTransport.ts
 * with the Node-`ws` → native-WebSocket substitutions described in
 * 06-PATTERNS.md (no heartbeat — browsers handle control frames).
 *
 * Pitfall 1: only this module ever constructs `new WebSocket(...)`. Components
 * MUST consume via the module-level store fed in main.tsx.
 */
export function createBrowserClientTransport(
  opts: BrowserClientOpts,
): ITransport {
  let ws: WebSocket | null = null;
  const handlers = new Set<(msg: Message) => void>();
  let backoff = 1_000;
  let shuttingDown = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    if (shuttingDown) return;
    const sock = new WebSocket(opts.url);
    ws = sock;

    sock.onopen = (): void => {
      backoff = 1_000;
      opts.onOpen?.();
    };

    sock.onmessage = (ev: MessageEvent): void => {
      try {
        const raw = typeof ev.data === "string" ? ev.data : "";
        const parsed = MessageSchema.parse(JSON.parse(raw));
        handlers.forEach((h) => h(parsed));
      } catch {
        // Drop malformed payloads silently (T-06-09 mitigation).
      }
    };

    sock.onclose = (ev: CloseEvent): void => {
      ws = null;
      opts.onClose?.(ev.code, ev.reason);
      if (shuttingDown) return;
      reconnectTimer = setTimeout(() => {
        backoff = Math.min(backoff * 2, 30_000);
        connect();
      }, backoff);
    };

    sock.onerror = (): void => {
      // 'close' will follow; nothing to do.
    };
  }

  connect();

  return {
    async send(msg: Message): Promise<void> {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("not_connected");
      }
      ws.send(JSON.stringify(msg));
    },
    onMessage(handler: (msg: Message) => void): Unsubscribe {
      handlers.add(handler);
      return (): void => {
        handlers.delete(handler);
      };
    },
    async close(): Promise<void> {
      shuttingDown = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ws?.close(1000, "shutdown");
    },
  };
}
