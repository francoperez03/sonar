// AXL build: gensyn-ai/axl @ 9cba555ff0b8e14ebf1244ae02b274fbc4ec044e
// Spike date: 2026-04-30 (Phase 6 plan 06-06, Branch A — primary clause)
//
// HTTP-poll adapter conforming to ITransport. Talks to a local AXL bridge
// at `bridgeUrl` (default 127.0.0.1:9002):
//   - send(msg) -> POST /send with X-Destination-Peer-Id and JSON body
//   - onMessage(h) <- GET /recv (long-poll loop): 204 = empty, 200 = body
//
// Mirrors createBrowserClientTransport.ts in shape: parse with `Message`
// (T-06-22 mitigation), swallow malformed bodies silently, exponential
// backoff on transport errors. The poll loop is started eagerly on factory
// invocation; close() flips a stop flag.
import type { ITransport, Unsubscribe, Message } from "@sonar/shared";
import { Message as MessageSchema } from "@sonar/shared";

export interface AxlClientOpts {
  bridgeUrl: string; // e.g. http://127.0.0.1:9002
  destPeerId: string; // 64-char hex ed25519 public key of the remote peer
  pollMs?: number; // default 250
  onError?: (err: unknown) => void;
}

/**
 * AXL ITransport adapter (Branch A of TRAN-03 spike).
 *
 * The AXL bridge has no auth on loopback (T-06-21 accepted); body parsing
 * goes through `Message.parse(JSON.parse(body))` to mitigate T-06-22.
 *
 * Polling cadence defaults to 250ms — high enough to feel live in the
 * EventLog, low enough not to load the local node. On fetch error the
 * loop swallows + waits one full pollMs before trying again (linear, not
 * exponential — failures here are rare and the local bridge restarts fast).
 */
export function createAxlClientTransport(opts: AxlClientOpts): ITransport {
  const handlers = new Set<(msg: Message) => void>();
  let stopped = false;
  const pollMs = opts.pollMs ?? 250;

  void (async function pollLoop(): Promise<void> {
    while (!stopped) {
      try {
        const r = await fetch(`${opts.bridgeUrl}/recv`);
        if (r.status === 200) {
          const text = await r.text();
          try {
            const parsed = MessageSchema.parse(JSON.parse(text));
            handlers.forEach((h) => h(parsed));
          } catch {
            // Malformed payload — drop silently (T-06-22 mitigation).
          }
        }
        // 204 = empty queue; just sleep below.
      } catch (err) {
        opts.onError?.(err);
        // Swallow transport errors and continue polling.
      }
      await new Promise<void>((res) => setTimeout(res, pollMs));
    }
  })();

  return {
    async send(msg: Message): Promise<void> {
      const r = await fetch(`${opts.bridgeUrl}/send`, {
        method: "POST",
        headers: {
          "X-Destination-Peer-Id": opts.destPeerId,
          "Content-Type": "application/octet-stream",
        },
        body: JSON.stringify(msg),
      });
      if (!r.ok) {
        throw new Error(`axl_send_failed_${r.status}`);
      }
    },
    onMessage(handler: (msg: Message) => void): Unsubscribe {
      handlers.add(handler);
      return (): void => {
        handlers.delete(handler);
      };
    },
    async close(): Promise<void> {
      stopped = true;
    },
  };
}
