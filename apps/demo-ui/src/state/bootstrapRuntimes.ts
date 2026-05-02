import { store } from "./store.js";
import type { RuntimeStatus } from "./reducer.js";

const VALID_STATUSES: ReadonlySet<RuntimeStatus> = new Set([
  "registered",
  "awaiting",
  "received",
  "deprecated",
  "revoked",
  "clone-rejected",
]);

/**
 * Boot-time GET /runtimes — hydrates the store with whatever wallet
 * addresses the operator already has cached (so a page refresh after a
 * rotation still shows the wallets, even before any new event arrives
 * over the WS / AXL bus).
 *
 * Idempotent and best-effort: never throws. If the operator is unreachable
 * we just leave the runtimes blank — the next live `wallet_assigned` event
 * will fill them in.
 */
function operatorHttpUrl(): string {
  const explicit = import.meta.env.VITE_OPERATOR_HTTP_URL;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const ws = (import.meta.env.VITE_OPERATOR_WS_URL ?? "ws://localhost:8787/logs") as string;
  return ws
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://")
    .replace(/\/logs$/, "");
}

interface RuntimeRecord {
  runtimeId: string;
  status?: string;
  walletAddress?: string;
  walletAssignedAt?: number;
}

export async function bootstrapRuntimes(): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${operatorHttpUrl()}/runtimes`, {
      headers: { "ngrok-skip-browser-warning": "1" },
    });
  } catch {
    return;
  }
  if (!res.ok) return;
  const body = (await res.json().catch(() => null)) as { runtimes?: RuntimeRecord[] } | null;
  if (!body?.runtimes) return;
  for (const r of body.runtimes) {
    const status = r.status && VALID_STATUSES.has(r.status as RuntimeStatus)
      ? (r.status as RuntimeStatus)
      : undefined;
    store.bootstrapRuntime({
      runtimeId: r.runtimeId,
      status,
      walletAddress: r.walletAddress as `0x${string}` | undefined,
      walletAssignedAt: r.walletAssignedAt,
    });
  }
}
