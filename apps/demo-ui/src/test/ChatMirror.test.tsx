import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

async function loadChat() {
  vi.resetModules();
  const storeMod = await import("../state/store.js");
  const ChatMod = await import("../components/sidebar/ChatMirror.js");
  return { store: storeMod.store, ChatMirror: ChatMod.ChatMirror };
}

describe("ChatMirror", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("renders empty-state copy when there are no chats", async () => {
    const { ChatMirror } = await loadChat();
    render(<ChatMirror />);
    expect(screen.getByText("Awaiting prompt")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Type below to drive the agent/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders a user bubble with role-marker class after a user ChatMsg", async () => {
    const { store, ChatMirror } = await loadChat();
    store.receive({
      type: "chat",
      role: "user",
      content: "hello world",
      timestamp: 1,
    });
    render(<ChatMirror />);
    const node = screen.getByText("hello world");
    // walk up to bubble container
    const bubble = node.closest(".chat-bubble");
    expect(bubble).not.toBeNull();
    expect(bubble?.className).toMatch(/chat-bubble--user/);
    expect(bubble?.getAttribute("data-role")).toBe("user");
  });

  it("renders user then assistant bubbles in arrival order with distinct role classes", async () => {
    const { store, ChatMirror } = await loadChat();
    store.receive({ type: "chat", role: "user", content: "hi", timestamp: 1 });
    store.receive({ type: "chat", role: "assistant", content: "hey", timestamp: 2 });
    render(<ChatMirror />);

    const userBubble = screen.getByText("hi").closest(".chat-bubble");
    const asstBubble = screen.getByText("hey").closest(".chat-bubble");
    expect(userBubble?.className).toMatch(/user/);
    expect(asstBubble?.className).toMatch(/assistant/);
    expect(asstBubble?.className).not.toMatch(/user/);
  });

  it("user bubble class contains 'user'; assistant bubble class contains 'assistant'", async () => {
    const { store, ChatMirror } = await loadChat();
    store.receive({ type: "chat", role: "assistant", content: "alone", timestamp: 1 });
    render(<ChatMirror />);
    const bubble = screen.getByText("alone").closest(".chat-bubble");
    expect(bubble?.className).toContain("assistant");
    expect(bubble?.className).not.toContain("user");
  });
});
