import { useSyncExternalStore } from "react";
import { store } from "./store.js";
import type {
  AgentDraft,
  ChatRow,
  ConnectionState,
  DeprecationRecord,
  DemoState,
  EventRow,
  RuntimeView,
  RuntimeId,
} from "./reducer.js";

/**
 * useSyncExternalStore-backed selector hooks (RESEARCH Pattern 2).
 *
 * Each hook returns a stable reference per state version (the reducer rebuilds
 * the slice only when the message touches it), so concurrent rendering stays
 * tear-free. No Context.Provider involved.
 */

const subscribe = (l: () => void): (() => void) => store.subscribe(l);

export function useRuntimes(): Record<RuntimeId, RuntimeView> {
  return useSyncExternalStore(subscribe, () => store.getSnapshot().runtimes);
}

export function useChats(): ChatRow[] {
  return useSyncExternalStore(subscribe, () => store.getSnapshot().chats);
}

export function useEvents(): EventRow[] {
  return useSyncExternalStore(subscribe, () => store.getSnapshot().events);
}

export function useLastDeprecation(): DeprecationRecord | null {
  return useSyncExternalStore(subscribe, () => store.getSnapshot().lastDeprecation);
}

export function useConnection(): ConnectionState {
  return useSyncExternalStore(subscribe, () => store.getSnapshot().connection);
}

export function useAgentDraft(): AgentDraft | null {
  return useSyncExternalStore(subscribe, () => store.getSnapshot().agentDraft);
}

export function useAgentBusy(): boolean {
  return useSyncExternalStore(subscribe, () => store.getSnapshot().agentBusy);
}

export type { DemoState };
