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

export interface DemoState {
  runtimes: Record<RuntimeId, RuntimeView>;
  chats: ChatRow[];
  events: EventRow[];
  lastDeprecation: DeprecationRecord | null;
}

// RESEARCH Pattern 3 — canonical transition table.
const ALLOWED: Record<RuntimeStatus, RuntimeStatus[]> = {
  registered: ["awaiting", "revoked"],
  awaiting: ["received", "revoked", "clone-rejected"],
  received: ["deprecated", "revoked"],
  deprecated: [],
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

const WALLETS_DEPRECATED_RE = /WalletsDeprecated.*?(0x[a-fA-F0-9]{64})/;
const CLONE_REJECTED_RE = /^Clone rejected:/;

function isRuntimeId(id: string): id is RuntimeId {
  return (RUNTIME_IDS as readonly string[]).includes(id);
}

function appendCapped<T>(arr: T[], item: T, cap: number): T[] {
  const next = arr.length >= cap ? arr.slice(arr.length - cap + 1) : arr.slice();
  next.push(item);
  return next;
}

export const initialState: DemoState = {
  runtimes: {
    alpha: { id: "alpha", pubkey: null, status: "registered", lastEventAt: null },
    beta: { id: "beta", pubkey: null, status: "registered", lastEventAt: null },
    gamma: { id: "gamma", pubkey: null, status: "registered", lastEventAt: null },
    "gamma-clone": {
      id: "gamma-clone",
      pubkey: null,
      status: "registered",
      lastEventAt: null,
    },
  },
  chats: [],
  events: [],
  lastDeprecation: null,
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

    case "log_entry": {
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
