import { describe, it, expect } from "vitest";
import {
  reduce,
  initialState,
  type DemoState,
  type RuntimeId,
  type RuntimeStatus,
} from "../state/reducer.js";
import type {
  Message,
  StatusChangeMsg,
  LogEntryMsg,
  ChatMsg,
  RegisterMsg,
  ChallengeMsg,
} from "@sonar/shared";

function statusChange(
  runtimeId: RuntimeId,
  status: Exclude<RuntimeStatus, "clone-rejected">,
  timestamp = 1_700_000_000_000,
): StatusChangeMsg {
  return {
    type: "status_change",
    runtimeId,
    // RuntimeStatus is a superset of the on-wire enum; the cast is safe for
    // 'registered' | 'awaiting' | 'received' | 'deprecated' | 'revoked'.
    status: status as StatusChangeMsg["status"],
    timestamp,
  };
}

function logEntry(
  runtimeId: string,
  message: string,
  timestamp = 1_700_000_000_000,
): LogEntryMsg {
  return {
    type: "log_entry",
    runtimeId,
    level: "info",
    message,
    timestamp,
  };
}

function chat(role: "user" | "assistant", content: string, timestamp = 1_700_000_000_000): ChatMsg {
  return { type: "chat", role, content, timestamp };
}

function withStatus(state: DemoState, id: RuntimeId, status: RuntimeStatus): DemoState {
  return {
    ...state,
    runtimes: {
      ...state.runtimes,
      [id]: { ...state.runtimes[id], status },
    },
  };
}

describe("reducer.transitions — initialState", () => {
  it("has exactly 4 runtimes with expected ids and registered status", () => {
    const ids = Object.keys(initialState.runtimes).sort();
    expect(ids).toEqual(["alpha", "beta", "gamma", "gamma-clone"]);
    for (const id of ids) {
      const r = initialState.runtimes[id as RuntimeId];
      expect(r.status).toBe("registered");
      expect(r.pubkey).toBeNull();
      expect(r.lastEventAt).toBeNull();
    }
    expect(initialState.chats).toEqual([]);
    expect(initialState.events).toEqual([]);
    expect(initialState.lastDeprecation).toBeNull();
  });
});

describe("reducer.transitions — ALLOWED transitions", () => {
  it("registered → awaiting allowed", () => {
    const next = reduce(initialState, statusChange("alpha", "awaiting", 111));
    expect(next.runtimes.alpha.status).toBe("awaiting");
    expect(next.runtimes.alpha.lastEventAt).toBe(111);
  });

  it("registered → received NOT allowed (state unchanged)", () => {
    const next = reduce(initialState, statusChange("alpha", "received"));
    expect(next.runtimes.alpha.status).toBe("registered");
    expect(next.runtimes.alpha.lastEventAt).toBeNull();
  });

  it("awaiting → received allowed", () => {
    const s = withStatus(initialState, "alpha", "awaiting");
    const next = reduce(s, statusChange("alpha", "received", 222));
    expect(next.runtimes.alpha.status).toBe("received");
    expect(next.runtimes.alpha.lastEventAt).toBe(222);
  });

  it("awaiting → registered NOT allowed", () => {
    const s = withStatus(initialState, "alpha", "awaiting");
    const next = reduce(s, statusChange("alpha", "registered"));
    expect(next.runtimes.alpha.status).toBe("awaiting");
  });

  it("received → deprecated allowed", () => {
    const s = withStatus(initialState, "beta", "received");
    const next = reduce(s, statusChange("beta", "deprecated", 333));
    expect(next.runtimes.beta.status).toBe("deprecated");
    expect(next.runtimes.beta.lastEventAt).toBe(333);
  });

  it("deprecated → received NOT allowed (terminal)", () => {
    const s = withStatus(initialState, "beta", "deprecated");
    const next = reduce(s, statusChange("beta", "received"));
    expect(next.runtimes.beta.status).toBe("deprecated");
  });

  it("revoked is terminal — no further transitions accepted", () => {
    const s = withStatus(initialState, "gamma", "revoked");
    const next = reduce(s, statusChange("gamma", "deprecated"));
    expect(next.runtimes.gamma.status).toBe("revoked");
    const next2 = reduce(s, statusChange("gamma", "received"));
    expect(next2.runtimes.gamma.status).toBe("revoked");
  });

  it("clone-rejected is terminal", () => {
    const s = withStatus(initialState, "gamma-clone", "clone-rejected");
    const next = reduce(s, statusChange("gamma-clone", "received"));
    expect(next.runtimes["gamma-clone"].status).toBe("clone-rejected");
  });
});

describe("reducer.transitions — independence + lastEventAt", () => {
  it("status_change for alpha doesn't touch beta/gamma/gamma-clone", () => {
    const next = reduce(initialState, statusChange("alpha", "awaiting", 999));
    expect(next.runtimes.alpha.status).toBe("awaiting");
    expect(next.runtimes.beta.status).toBe("registered");
    expect(next.runtimes.gamma.status).toBe("registered");
    expect(next.runtimes["gamma-clone"].status).toBe("registered");
  });

  it("lastEventAt is bumped from msg.timestamp on accepted transitions", () => {
    const next = reduce(initialState, statusChange("alpha", "awaiting", 12345));
    expect(next.runtimes.alpha.lastEventAt).toBe(12345);
  });
});

describe("reducer.transitions — chats and events", () => {
  it("ChatMsg appends to state.chats in arrival order; chats are immutable arrays", () => {
    const s1 = reduce(initialState, chat("user", "hello", 1));
    const s2 = reduce(s1, chat("assistant", "hi", 2));
    expect(s2.chats).toHaveLength(2);
    expect(s2.chats[0]?.role).toBe("user");
    expect(s2.chats[1]?.role).toBe("assistant");
    expect(s2.chats[0]?.content).toBe("hello");
    // Original arrays not mutated
    expect(initialState.chats).toHaveLength(0);
    expect(s1.chats).toHaveLength(1);
    expect(s2.chats).not.toBe(s1.chats);
  });

  it("LogEntryMsg appends to state.events", () => {
    const s = reduce(initialState, logEntry("alpha", "boot complete"));
    expect(s.events).toHaveLength(1);
    expect(s.events[0]?.message).toBe("boot complete");
    expect(s.events[0]?.runtimeId).toBe("alpha");
  });
});

describe("reducer.transitions — UI-side derivations", () => {
  it("LogEntryMsg with 'Clone rejected: ...' sets gamma-clone.status='clone-rejected' and appends event", () => {
    const msg = logEntry(
      "gamma-clone",
      "Clone rejected: gamma-clone presented a copied pubkey; handshake denied.",
      555,
    );
    const next = reduce(initialState, msg);
    expect(next.runtimes["gamma-clone"].status).toBe("clone-rejected");
    expect(next.runtimes["gamma-clone"].lastEventAt).toBe(555);
    expect(next.events).toHaveLength(1);
  });

  it("LogEntryMsg with WalletsDeprecated + 0x… 64-hex tx hash sets state.lastDeprecation", () => {
    const txHash =
      "0x" + "a".repeat(64);
    const msg = logEntry(
      "operator",
      `WalletsDeprecated emitted at ${txHash}`,
      777,
    );
    const next = reduce(initialState, msg);
    expect(next.lastDeprecation).not.toBeNull();
    expect(next.lastDeprecation?.hash).toBe(txHash);
    expect(next.lastDeprecation?.timestamp).toBe(777);
    expect(next.events).toHaveLength(1);
  });
});

describe("reducer.transitions — register + unknown messages", () => {
  it("RegisterMsg sets pubkey for that runtimeId; status remains 'registered'", () => {
    const msg: RegisterMsg = {
      type: "register",
      runtimeId: "alpha",
      pubkey: "PUBKEY_BASE64",
    };
    const next = reduce(initialState, msg);
    expect(next.runtimes.alpha.pubkey).toBe("PUBKEY_BASE64");
    expect(next.runtimes.alpha.status).toBe("registered");
  });

  it("Unknown/unhandled message types are no-ops (state returned unchanged by identity)", () => {
    const msg: ChallengeMsg = {
      type: "challenge",
      runtimeId: "alpha",
      nonce: "noncebase64",
    };
    const next = reduce(initialState, msg as Message);
    expect(next).toBe(initialState);
  });
});
