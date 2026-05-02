import { useSyncExternalStore } from 'react';
import { store } from './store.js';
import type {
  AgentDraft,
  ChatRow,
  ConnectionState,
  DeprecationRecord,
  DemoState,
  EventRow,
  RuntimeView,
  RuntimeId,
  TransportKind,
} from './reducer.js';

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

export function useRotationInFlight(): boolean {
  return useSyncExternalStore(subscribe, () => {
    const runtimes = store.getSnapshot().runtimes;
    return Object.values(runtimes).some(
      (runtime) => runtime.status === 'awaiting' || runtime.status === 'received',
    );
  });
}

export function useTransport(): TransportKind {
  return useSyncExternalStore(subscribe, () => store.getSnapshot().connection.transport);
}

export function useAxlAvailable(): boolean {
  return Boolean(
    import.meta.env.VITE_AXL_BRIDGE_URL && import.meta.env.VITE_AXL_DEST_PEER_ID,
  );
}

export type { DemoState };
