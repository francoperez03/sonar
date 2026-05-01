import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StatusChangeMsg } from "@sonar/shared";

// store is a module-level singleton — the simplest way to get a fresh state
// per test is dynamic import + vi.resetModules().
async function loadStore() {
  vi.resetModules();
  return await import("../state/store.js");
}

describe("store.fanout", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("starts at initialState (4 runtimes registered, empty chats/events)", async () => {
    const { store } = await loadStore();
    const snap = store.getSnapshot();
    expect(Object.keys(snap.runtimes).sort()).toEqual([
      "alpha",
      "beta",
      "gamma",
      "gamma-clone",
    ]);
    expect(snap.chats).toEqual([]);
    expect(snap.events).toEqual([]);
  });

  it("subscribe registers a listener; returned function unregisters", async () => {
    const { store } = await loadStore();
    const fn = vi.fn();
    const unsub = store.subscribe(fn);
    expect(typeof unsub).toBe("function");
    const msg: StatusChangeMsg = {
      type: "status_change",
      runtimeId: "alpha",
      status: "awaiting",
      timestamp: 1,
    };
    store.receive(msg);
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    store.receive(msg);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("receive notifies all subscribers and updates getSnapshot", async () => {
    const { store } = await loadStore();
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    const msg: StatusChangeMsg = {
      type: "status_change",
      runtimeId: "alpha",
      status: "awaiting",
      timestamp: 42,
    };
    store.receive(msg);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().runtimes.alpha.status).toBe("awaiting");
    expect(store.getSnapshot().runtimes.alpha.lastEventAt).toBe(42);
  });

  it("multiple receives notify each subscriber once per receive", async () => {
    const { store } = await loadStore();
    const fn = vi.fn();
    store.subscribe(fn);
    const msg: StatusChangeMsg = {
      type: "status_change",
      runtimeId: "beta",
      status: "awaiting",
      timestamp: 1,
    };
    store.receive(msg);
    store.receive({ ...msg, status: "received", timestamp: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("unsubscribed listeners do not fire", async () => {
    const { store } = await loadStore();
    const fn = vi.fn();
    const unsub = store.subscribe(fn);
    unsub();
    store.receive({
      type: "status_change",
      runtimeId: "alpha",
      status: "awaiting",
      timestamp: 1,
    });
    expect(fn).not.toHaveBeenCalled();
  });
});
