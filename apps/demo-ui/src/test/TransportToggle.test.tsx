import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// The toggle reads useAxlAvailable() which evaluates VITE env vars from
// `import.meta.env`. We have to set those BEFORE the component module is
// imported because Vitest evaluates ES modules eagerly. Use stubEnv +
// resetModules between tests.

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadToggle(env: Record<string, string>): Promise<{ TransportToggle: typeof import("../components/shell/TransportToggle.js")["TransportToggle"] }> {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const mod = await import("../components/shell/TransportToggle.js");
  return mod;
}

describe("TransportToggle", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("does not render when AXL is not configured", async () => {
    const { TransportToggle } = await loadToggle({
      VITE_AXL_BRIDGE_URL: "",
      VITE_AXL_DEST_PEER_ID: "",
    });
    const { container } = render(<TransportToggle />);
    expect(container.firstChild).toBeNull();
  });

  it("renders both buttons when AXL is configured", async () => {
    const { TransportToggle } = await loadToggle({
      VITE_AXL_BRIDGE_URL: "/axl",
      VITE_AXL_DEST_PEER_ID: "deadbeef",
    });
    render(<TransportToggle />);
    expect(screen.getByTestId("transport-toggle-ws")).toBeInTheDocument();
    expect(screen.getByTestId("transport-toggle-axl")).toBeInTheDocument();
  });
});
