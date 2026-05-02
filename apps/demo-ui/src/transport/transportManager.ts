import type { ITransport, Unsubscribe } from "@sonar/shared";
import { createBrowserClientTransport } from "./createBrowserClientTransport.js";
import { createAxlClientTransport } from "./createAxlClientTransport.js";
import { store } from "../state/store.js";

/**
 * Single-source transport manager. The browser app is allowed to swap between
 * transports at runtime (WebSocket ↔ AXL), but the *singleton* invariant is
 * preserved: at any instant exactly one transport is alive, with one
 * subscription wired into `store.receive`. Pitfall 1 of the original main.tsx
 * (don't construct transports inside effects) still holds — components only
 * call `swapTransport()` from event handlers, never from an effect that
 * could fire twice under StrictMode.
 */

export type TransportKind = "ws" | "axl";

export interface TransportConfig {
  wsUrl: string;
  axl: {
    bridgeUrl: string;
    destPeerId: string;
    available: boolean;
  };
}

let cfg: TransportConfig | null = null;
let active: { kind: TransportKind; transport: ITransport; unsubscribe: Unsubscribe } | null = null;

export function configureTransport(c: TransportConfig): void {
  cfg = c;
}

export function activeTransportKind(): TransportKind {
  return active?.kind ?? "ws";
}

function spawn(kind: TransportKind): ITransport {
  if (!cfg) throw new Error("transportManager not configured");
  if (kind === "axl") {
    return createAxlClientTransport({
      bridgeUrl: cfg.axl.bridgeUrl,
      destPeerId: cfg.axl.destPeerId,
    });
  }
  return createBrowserClientTransport({
    url: cfg.wsUrl,
    onOpen: () =>
      store.setConnection({
        status: "open",
        url: cfg!.wsUrl,
        closeCode: null,
        closeReason: null,
      }),
    onClose: (code, reason) =>
      store.setConnection({
        status: "closed",
        closeCode: code,
        closeReason: reason,
      }),
  });
}

export async function swapTransport(kind: TransportKind): Promise<void> {
  if (!cfg) throw new Error("transportManager not configured");
  if (active?.kind === kind) return;

  // Tear down the previous transport (handlers + socket) before standing up
  // the new one. This avoids a brief window where both run in parallel and
  // the store sees duplicate frames.
  if (active) {
    active.unsubscribe();
    try {
      await active.transport.close();
    } catch {
      // ignore — the close path is best-effort
    }
  }

  // For AXL we synthesize "open" once the first frame arrives (the adapter
  // has no open/close lifecycle). For WS the createBrowserClientTransport
  // wires its own onOpen/onClose into the store.
  store.setConnection({
    status: "connecting",
    transport: kind,
    url: kind === "axl" ? cfg.axl.bridgeUrl : cfg.wsUrl,
    lastMessageAt: null,
    closeCode: null,
    closeReason: null,
  });

  const transport = spawn(kind);
  const unsubscribe = transport.onMessage((msg) => {
    if (kind === "axl") {
      // Promote AXL to "open" on the first message — gives the badge an
      // affirmative LIVE state without needing socket-level callbacks.
      const conn = store.getSnapshot().connection;
      if (conn.status !== "open") {
        store.setConnection({ status: "open", closeCode: null, closeReason: null });
      }
    }
    store.receive(msg);
  });
  active = { kind, transport, unsubscribe };
}
