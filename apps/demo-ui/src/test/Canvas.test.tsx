import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

async function loadCanvas() {
  vi.resetModules();
  const storeMod = await import("../state/store.js");
  const CanvasMod = await import("../components/canvas/Canvas.js");
  return { store: storeMod.store, Canvas: CanvasMod.Canvas };
}

describe("Canvas", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("renders 4 runtime nodes (alpha, beta, gamma, gamma-clone)", async () => {
    const { Canvas } = await loadCanvas();
    render(<Canvas />);
    expect(screen.getByTestId("runtime-node-alpha")).toBeInTheDocument();
    expect(screen.getByTestId("runtime-node-beta")).toBeInTheDocument();
    expect(screen.getByTestId("runtime-node-gamma")).toBeInTheDocument();
    expect(screen.getByTestId("runtime-node-gamma-clone")).toBeInTheDocument();
  });

  it("renders 3 service node labels: OPERATOR, KEEPERHUB, CHAIN", async () => {
    const { Canvas } = await loadCanvas();
    render(<Canvas />);
    expect(screen.getByText("OPERATOR")).toBeInTheDocument();
    expect(screen.getByText("KEEPERHUB")).toBeInTheDocument();
    expect(screen.getByText("CHAIN")).toBeInTheDocument();
  });

  it("renders the idle hint when all runtimes are 'registered'", async () => {
    const { Canvas } = await loadCanvas();
    render(<Canvas />);
    expect(
      screen.getByText("Standing by — 3 runtimes registered, clone candidate at the edge."),
    ).toBeInTheDocument();
  });

  it("after status_change to 'awaiting', alpha node has the awaiting class and idle hint disappears", async () => {
    const { store, Canvas } = await loadCanvas();
    render(<Canvas />);
    await act(async () => {
      store.receive({
        type: "status_change",
        runtimeId: "alpha",
        status: "awaiting",
        timestamp: Date.now(),
      });
    });
    const alpha = screen.getByTestId("runtime-node-alpha");
    expect(alpha.className).toContain("awaiting");
    expect(
      screen.queryByText("Standing by — 3 runtimes registered, clone candidate at the edge."),
    ).toBeNull();
  });

  it("after a 'Clone rejected:' log_entry, gamma-clone node has the clone-rejected class", async () => {
    const { store, Canvas } = await loadCanvas();
    render(<Canvas />);
    await act(async () => {
      store.receive({
        type: "log_entry",
        runtimeId: "gamma-clone",
        level: "warn",
        message: "Clone rejected: gamma-clone presented a copied pubkey; handshake denied.",
        timestamp: Date.now(),
      });
    });
    const ghost = screen.getByTestId("runtime-node-gamma-clone");
    expect(ghost.className).toContain("clone-rejected");
  });
});
