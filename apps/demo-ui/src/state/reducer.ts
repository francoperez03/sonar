import type { Message } from "@sonar/shared";

export type RuntimeStatus =
  | "registered"
  | "awaiting"
  | "received"
  | "deprecated"
  | "revoked"
  | "clone-rejected";

export type RuntimeId = "alpha" | "beta" | "gamma" | "gamma-clone";

const RUNTIME_IDS: readonly RuntimeId[] = ["alpha", "beta", "gamma", "gamma-clone"];

export interface RuntimeView {
  id: RuntimeId;
  pubkey: string | null;
  status: RuntimeStatus;
  lastEventAt: number | null;
  walletAddress: `0x${string}` | null;
  walletAssignedAt: number | null;
}

export interface ChatRow {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  id: string;
}

export interface EventRow {
  kind: string;
  message: string;
  runtimeId?: string;
  timestamp: number;
  id: string;
}

export interface DeprecationRecord {
  hash: string;
  timestamp: number;
}

export type ConnectionStatus = "connecting" | "open" | "closed";
export type TransportKind = "ws" | "axl";

export interface ConnectionState {
  status: ConnectionStatus;
  url: string | null;
  lastMessageAt: number | null;
  closeCode: number | null;
  closeReason: string | null;
  transport: TransportKind;
}

export interface AgentDraft {
  text: string;
  startedAt: number;
}

export interface DemoState {
  runtimes: Record<RuntimeId, RuntimeView>;
  chats: ChatRow[];
  events: EventRow[];
  lastDeprecation: DeprecationRecord | null;
  connection: ConnectionState;
  agentDraft: AgentDraft | null;
  agentBusy: boolean;
}

// RESEARCH Pattern 3 — canonical transition table.
// `received → awaiting` is allowed for re-rotations: once a runtime has its
// first key, subsequent rotations restart the awaiting/received cycle.
const ALLOWED: Record<RuntimeStatus, RuntimeStatus[]> = {
  registered: ["awaiting", "revoked"],
  awaiting: ["received", "revoked", "clone-rejected"],
  received: ["awaiting", "deprecated", "revoked"],
  deprecated: ["awaiting", "revoked"],
  revoked: [],
  "clone-rejected": [],
};

// Caps to mitigate T-06-10 (unbounded array growth). UI plan 04 owns virtualization.
const MAX_CHATS = 1000;
const MAX_EVENTS = 1000;

// Module-scope monotonic counter for deterministic, unique row ids without
// relying on Date.now (which collides during fast bursts in tests).
let __seq = 0;
function nextId(timestamp: number): string {
  __seq += 1;
  return `${timestamp}-${__seq}`;
}

// Matches either the contract event name (WalletsDeprecated) or the operator's
// /rotation/log-ingest tag (deprecate_tx) followed somewhere later by a tx hash.
const WALLETS_DEPRECATED_RE = /(?:WalletsDeprecated|deprecate_tx).*?(0x[a-fA-F0-9]{64})/;
const CLONE_REJECTED_RE = /^Clone rejected:/;

function isRuntimeId(id: string): id is RuntimeId {
  return (RUNTIME_IDS as readonly string[]).includes(id);
}

function appendCapped<T>(arr: T[], item: T, cap: number): T[] {
  const next = arr.length >= cap ? arr.slice(arr.length - cap + 1) : arr.slice();
  next.push(item);
  return next;
}

function emptyRuntime(id: RuntimeId): RuntimeView {
  return {
    id,
    pubkey: null,
    status: "registered",
    lastEventAt: null,
    walletAddress: null,
    walletAssignedAt: null,
  };
}

export const initialState: DemoState = {
  runtimes: {
    alpha: emptyRuntime("alpha"),
    beta: emptyRuntime("beta"),
    gamma: emptyRuntime("gamma"),
    "gamma-clone": emptyRuntime("gamma-clone"),
  },
  chats: [],
  events: [],
  lastDeprecation: null,
  connection: {
    status: "connecting",
    url: null,
    lastMessageAt: null,
    closeCode: null,
    closeReason: null,
    transport: "ws",
  },
  agentDraft: null,
  agentBusy: false,
};

export function reduce(state: DemoState, msg: Message): DemoState {
  switch (msg.type) {
    case "status_change": {
      if (!isRuntimeId(msg.runtimeId)) return state;
      const current = state.runtimes[msg.runtimeId];
      const allowed = ALLOWED[current.status];
      // msg.status is a subset of RuntimeStatus (no 'clone-rejected' on wire)
      const target = msg.status as RuntimeStatus;
      if (!allowed.includes(target)) return state;
      return {
        ...state,
        runtimes: {
          ...state.runtimes,
          [msg.runtimeId]: {
            ...current,
            status: target,
            lastEventAt: msg.timestamp,
          },
        },
      };
    }

    case "register": {
      if (!isRuntimeId(msg.runtimeId)) return state;
      const current = state.runtimes[msg.runtimeId];
      return {
        ...state,
        runtimes: {
          ...state.runtimes,
          [msg.runtimeId]: { ...current, pubkey: msg.pubkey },
        },
      };
    }

    case "chat": {
      const row: ChatRow = {
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        id: nextId(msg.timestamp),
      };
      return {
        ...state,
        chats: appendCapped(state.chats, row, MAX_CHATS),
      };
    }

    case "wallet_assigned": {
      if (!isRuntimeId(msg.runtimeId)) return state;
      const current = state.runtimes[msg.runtimeId];
      return {
        ...state,
        runtimes: {
          ...state.runtimes,
          [msg.runtimeId]: {
            ...current,
            walletAddress: msg.address as `0x${string}`,
            walletAssignedAt: msg.timestamp,
          },
        },
      };
    }

    case "log_entry": {
      // Suppress retry-spam from runtimes stuck in revoked: 1×/s of these
      // would drown the EventLog. They carry no UI signal — the runtime's
      // revoked status is already reflected on the canvas.
      if (msg.message === "register_rejected_revoked") return state;

      const row: EventRow = {
        kind: msg.level,
        message: msg.message,
        runtimeId: msg.runtimeId,
        timestamp: msg.timestamp,
        id: nextId(msg.timestamp),
      };

      let next: DemoState = {
        ...state,
        events: appendCapped(state.events, row, MAX_EVENTS),
      };

      // UI-side derivation A7 — "Clone rejected: ..." flips gamma-clone status.
      if (CLONE_REJECTED_RE.test(msg.message)) {
        const clone = next.runtimes["gamma-clone"];
        if (clone.status !== "clone-rejected") {
          next = {
            ...next,
            runtimes: {
              ...next.runtimes,
              "gamma-clone": {
                ...clone,
                status: "clone-rejected",
                lastEventAt: msg.timestamp,
              },
            },
          };
        }
      }

      // UI-side derivation — WalletsDeprecated tx hash → footer chip.
      const wd = WALLETS_DEPRECATED_RE.exec(msg.message);
      if (wd && wd[1]) {
        next = {
          ...next,
          lastDeprecation: { hash: wd[1], timestamp: msg.timestamp },
        };
      }

      return next;
    }

    default:
      // Unknown / handshake / registry-ack messages are no-ops at the UI level.
      return state;
  }
}
