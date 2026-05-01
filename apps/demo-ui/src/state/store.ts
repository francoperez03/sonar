import type { Message } from "@sonar/shared";
import { reduce, initialState, type DemoState } from "./reducer.js";

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
    state = reduce(state, msg);
    listeners.forEach((l) => l());
  },
};
