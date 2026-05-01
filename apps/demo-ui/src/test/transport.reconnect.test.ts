import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createBrowserClientTransport } from "../transport/createBrowserClientTransport.js";
import type { LogEntryMsg } from "@sonar/shared";

// Hand-rolled MockWebSocket. EventTarget-based; supports the four
// onopen/onmessage/onclose/onerror property handlers that the adapter uses.
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  url: string;
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  // Test helpers — simulate server-side or browser-side WS lifecycle events.
  __open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }
  __message(data: string): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }
  __close(code = 1006, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    // CloseEvent isn't reliably constructable in jsdom; fake it.
    const ev = { code, reason } as unknown as CloseEvent;
    this.onclose?.(ev);
  }

  send(data: string): void {
    this.sent.push(data);
  }
  close(_code?: number, _reason?: string): void {
    this.closed = true;
    // Mirror real browser semantics: close() schedules an onclose with the
    // requested code (or 1006 if none). We invoke synchronously for
    // deterministic fake-timer behavior.
    this.__close(_code ?? 1000, _reason ?? "");
  }
}

const realWebSocket = globalThis.WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket =
    MockWebSocket;
  // Provide WebSocket.OPEN constant lookup used by the adapter.
  (MockWebSocket as unknown as { OPEN: number }).OPEN = 1;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  (globalThis as unknown as { WebSocket: typeof WebSocket | undefined }).WebSocket =
    realWebSocket;
});

function lastSocket(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
}

describe("createBrowserClientTransport", () => {
  it("constructs a WebSocket on creation and routes valid LogEntryMsg JSON to handlers", () => {
    const t = createBrowserClientTransport({ url: "ws://test/logs" });
    const handler = vi.fn();
    t.onMessage(handler);
    const sock = lastSocket();
    sock.__open();

    const msg: LogEntryMsg = {
      type: "log_entry",
      runtimeId: "alpha",
      level: "info",
      message: "hello",
      timestamp: 1,
    };
    sock.__message(JSON.stringify(msg));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it("drops malformed JSON without throwing or invoking handlers", () => {
    const t = createBrowserClientTransport({ url: "ws://test/logs" });
    const handler = vi.fn();
    t.onMessage(handler);
    const sock = lastSocket();
    sock.__open();
    expect(() => sock.__message("not json")).not.toThrow();
    expect(() => sock.__message(JSON.stringify({ type: "unknown" }))).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("after a close (1006) reconnects after backoff (~1s)", () => {
    createBrowserClientTransport({ url: "ws://test/logs" });
    expect(MockWebSocket.instances).toHaveLength(1);
    const sock = lastSocket();
    sock.__close(1006, "");
    // Initial backoff before doubling = 1s (per implementation contract).
    vi.advanceTimersByTime(1_000);
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);
  });

  it("backoff doubles on consecutive closes and caps at 30_000ms", () => {
    createBrowserClientTransport({ url: "ws://test/logs" });
    // Each close → after `backoff` ms → new socket → another close.
    // Schedule sequence: 1000, 2000, 4000, 8000, 16000, 30000 (capped).
    const expected = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
    for (let i = 0; i < expected.length; i++) {
      const sock = lastSocket();
      sock.__close(1006, "");
      vi.advanceTimersByTime(expected[i]!);
    }
    // 1 initial + 6 reconnects
    expect(MockWebSocket.instances.length).toBe(1 + expected.length);

    // One more close → still capped at 30_000
    const sock = lastSocket();
    sock.__close(1006, "");
    vi.advanceTimersByTime(29_999);
    const beforeCap = MockWebSocket.instances.length;
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances.length).toBe(beforeCap + 1);
  });

  it("close() prevents future reconnects", async () => {
    const t = createBrowserClientTransport({ url: "ws://test/logs" });
    const sock = lastSocket();
    sock.__open();
    await t.close();
    // Drain reconnect timer if any was queued
    vi.advanceTimersByTime(60_000);
    // Only the one initial socket should ever exist.
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("send() writes JSON.stringify(msg); rejects when readyState !== OPEN", async () => {
    const t = createBrowserClientTransport({ url: "ws://test/logs" });
    const sock = lastSocket();
    const msg: LogEntryMsg = {
      type: "log_entry",
      runtimeId: "alpha",
      level: "info",
      message: "x",
      timestamp: 1,
    };
    // Not open yet → reject
    await expect(t.send(msg)).rejects.toThrow(/not_connected/);
    sock.__open();
    await t.send(msg);
    expect(sock.sent).toEqual([JSON.stringify(msg)]);
  });

  it("backoff resets to 1s after a successful open following reconnect", () => {
    createBrowserClientTransport({ url: "ws://test/logs" });
    // First close → reconnect after 1s → simulate open → backoff resets
    lastSocket().__close(1006, "");
    vi.advanceTimersByTime(1_000);
    lastSocket().__open();
    // Now close again → next reconnect should be 1s, not 2s.
    lastSocket().__close(1006, "");
    vi.advanceTimersByTime(999);
    const before = MockWebSocket.instances.length;
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances.length).toBe(before + 1);
  });
});
