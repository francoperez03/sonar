import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createAxlClientTransport } from "../transport/createAxlClientTransport.js";
import type { LogEntryMsg } from "@sonar/shared";

// AXL adapter unit test (Branch A of TRAN-03 spike). Stubs global fetch so
// POST /send + a sequence of GET /recv responses (204, 204, 200) drive
// onMessage exactly once with a parsed Message. Also asserts that a thrown
// fetch is swallowed (the polling loop continues).

interface FakeResponse {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
}

function r200(body: string): FakeResponse {
  return { status: 200, ok: true, text: () => Promise.resolve(body) };
}
function r204(): FakeResponse {
  return { status: 204, ok: true, text: () => Promise.resolve("") };
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = realFetch;
});

describe("createAxlClientTransport", () => {
  it("send() POSTs to /send with X-Destination-Peer-Id and JSON body", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      // /recv path drains as empty for this test
      if (url.endsWith("/recv")) return r204() as unknown as Response;
      return { status: 200, ok: true, text: () => Promise.resolve("") } as unknown as Response;
    }) as typeof fetch;

    const t = createAxlClientTransport({
      bridgeUrl: "http://127.0.0.1:9002",
      destPeerId: "ab".repeat(32),
    });
    const msg: LogEntryMsg = {
      type: "log_entry",
      runtimeId: "alpha",
      level: "info",
      message: "hi",
      timestamp: 1,
    };
    await t.send(msg);

    const send = calls.find((c) => c.url.endsWith("/send"));
    expect(send).toBeDefined();
    expect(send!.init?.method).toBe("POST");
    const headers = send!.init?.headers as Record<string, string>;
    expect(headers["X-Destination-Peer-Id"]).toBe("ab".repeat(32));
    expect(send!.init?.body).toBe(JSON.stringify(msg));
    await t.close();
  });

  it("polling /recv: 204, 204, 200 drives onMessage exactly once with parsed Message", async () => {
    const msg: LogEntryMsg = {
      type: "log_entry",
      runtimeId: "alpha",
      level: "info",
      message: "from-axl",
      timestamp: 42,
    };
    const responses: FakeResponse[] = [r204(), r204(), r200(JSON.stringify(msg)), r204(), r204()];
    let i = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/recv")) {
        const next = responses[i] ?? r204();
        i++;
        return next as unknown as Response;
      }
      return r204() as unknown as Response;
    }) as typeof fetch;

    const handler = vi.fn();
    const t = createAxlClientTransport({
      bridgeUrl: "http://127.0.0.1:9002",
      destPeerId: "cd".repeat(32),
      pollMs: 10,
    });
    t.onMessage(handler);

    // Drive the poll loop: each iteration awaits fetch + setTimeout(pollMs).
    // Use real timers via runAllTicks-style flush, since async + fake timers
    // require nudging both microtasks and timers.
    for (let step = 0; step < 10; step++) {
      await vi.advanceTimersByTimeAsync(15);
    }

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(msg);
    await t.close();
  });

  it("thrown fetch is swallowed; polling continues and eventually delivers a message", async () => {
    const msg: LogEntryMsg = {
      type: "log_entry",
      runtimeId: "beta",
      level: "warn",
      message: "after-error",
      timestamp: 7,
    };
    let calls = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      if (!url.endsWith("/recv")) return r204() as unknown as Response;
      calls++;
      if (calls === 1) throw new Error("boom");
      if (calls === 2) return r200(JSON.stringify(msg)) as unknown as Response;
      return r204() as unknown as Response;
    }) as typeof fetch;

    const handler = vi.fn();
    const errs: unknown[] = [];
    const t = createAxlClientTransport({
      bridgeUrl: "http://127.0.0.1:9002",
      destPeerId: "ef".repeat(32),
      pollMs: 10,
      onError: (e) => errs.push(e),
    });
    t.onMessage(handler);

    for (let step = 0; step < 10; step++) {
      await vi.advanceTimersByTimeAsync(15);
    }
    expect(errs.length).toBeGreaterThanOrEqual(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(msg);
    await t.close();
  });

  it("malformed body is dropped silently (no throw, no handler call)", async () => {
    const responses: FakeResponse[] = [r200("not json"), r200(JSON.stringify({ type: "unknown" })), r204()];
    let i = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/recv")) {
        const next = responses[i] ?? r204();
        i++;
        return next as unknown as Response;
      }
      return r204() as unknown as Response;
    }) as typeof fetch;

    const handler = vi.fn();
    const t = createAxlClientTransport({
      bridgeUrl: "http://127.0.0.1:9002",
      destPeerId: "01".repeat(32),
      pollMs: 5,
    });
    t.onMessage(handler);

    for (let step = 0; step < 10; step++) {
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(handler).not.toHaveBeenCalled();
    await t.close();
  });

  it("close() stops polling — no fetch calls after close resolves", async () => {
    let recvCount = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/recv")) recvCount++;
      return r204() as unknown as Response;
    }) as typeof fetch;

    const t = createAxlClientTransport({
      bridgeUrl: "http://127.0.0.1:9002",
      destPeerId: "23".repeat(32),
      pollMs: 5,
    });
    // let it poll a few times
    for (let step = 0; step < 3; step++) {
      await vi.advanceTimersByTimeAsync(10);
    }
    await t.close();
    const before = recvCount;
    // After close, advance time — at most one in-flight iteration may settle.
    for (let step = 0; step < 5; step++) {
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(recvCount).toBeLessThanOrEqual(before + 1);
  });

  it("send() rejects when /send returns non-2xx", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/recv")) return r204() as unknown as Response;
      return { status: 502, ok: false, text: () => Promise.resolve("") } as unknown as Response;
    }) as typeof fetch;

    const t = createAxlClientTransport({
      bridgeUrl: "http://127.0.0.1:9002",
      destPeerId: "45".repeat(32),
    });
    const msg: LogEntryMsg = {
      type: "log_entry",
      runtimeId: "gamma",
      level: "error",
      message: "x",
      timestamp: 1,
    };
    await expect(t.send(msg)).rejects.toThrow(/axl_send_failed_502/);
    await t.close();
  });
});
