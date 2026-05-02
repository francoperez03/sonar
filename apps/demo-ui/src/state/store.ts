import type { Message } from "@sonar/shared";
import {
  reduce,
  initialState,
  type ConnectionStatus,
  type DemoState,
} from "./reducer.js";

/**
 * Module-level external store (RESEARCH Pattern 2). Single instance per
 * process. main.tsx wires the singleton transport to `store.receive` at module
 * scope (Pitfall 1, 2, 8 — never inside a component effect).
 *
 * Shape mirrors apps/operator/src/log/LogBus.ts: subscribe returns an
 * unsubscribe function; receive runs the reducer and notifies all listeners.
 */
let state: DemoState = initialState;
const listeners = new Set<() => void>();

export const store = {
  getSnapshot(): DemoState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return (): void => {
      listeners.delete(listener);
    };
  },
  receive(msg: Message): void {
    const next = reduce(state, msg);
    state = {
      ...next,
      connection: { ...next.connection, lastMessageAt: Date.now() },
    };
    listeners.forEach((l) => l());
  },
  setConnection(patch: Partial<DemoState["connection"]> & { status?: ConnectionStatus }): void {
    state = { ...state, connection: { ...state.connection, ...patch } };
    listeners.forEach((l) => l());
  },
  startAgentTurn(): void {
    state = {
      ...state,
      agentBusy: true,
      agentDraft: { text: "", startedAt: Date.now() },
    };
    listeners.forEach((l) => l());
  },
  appendAgentToken(text: string): void {
    if (!state.agentDraft) {
      state = { ...state, agentDraft: { text, startedAt: Date.now() } };
    } else {
      state = {
        ...state,
        agentDraft: { ...state.agentDraft, text: state.agentDraft.text + text },
      };
    }
    listeners.forEach((l) => l());
  },
  endAgentTurn(): void {
    state = { ...state, agentBusy: false, agentDraft: null };
    listeners.forEach((l) => l());
  },
  /**
   * Bootstrap-only override: set a runtime's status + walletAddress directly,
   * bypassing the reducer's transition guard. Used by bootstrapRuntimes()
   * after a page refresh so the UI reflects the operator's current truth even
   * though the WS has no past events to replay.
   */
  bootstrapRuntime(input: {
    runtimeId: string;
    status?: import("./reducer.js").RuntimeStatus;
    walletAddress?: `0x${string}`;
    walletAssignedAt?: number;
  }): void {
    const id = input.runtimeId as keyof DemoState["runtimes"];
    const current = state.runtimes[id];
    if (!current) return;
    state = {
      ...state,
      runtimes: {
        ...state.runtimes,
        [id]: {
          ...current,
          ...(input.status ? { status: input.status } : {}),
          ...(input.walletAddress ? { walletAddress: input.walletAddress } : {}),
          ...(input.walletAssignedAt ? { walletAssignedAt: input.walletAssignedAt } : {}),
        },
      },
    };
    listeners.forEach((l) => l());
  },
};
