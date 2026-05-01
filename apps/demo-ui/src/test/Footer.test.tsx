import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Module-level singletons (store + reducer/hooks) need a reset per test so a
// receive() in one test doesn't leak into the next.
async function loadShell() {
  vi.resetModules();
  const storeMod = await import("../state/store.js");
  const FooterMod = await import("../components/shell/Footer.js");
  return { store: storeMod.store, Footer: FooterMod.Footer };
}

describe("Footer", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("renders empty-state copy when there is no last deprecation", async () => {
    const { Footer } = await loadShell();
    render(<Footer />);
    expect(screen.getByText("LAST DEPRECATION")).toBeInTheDocument();
    expect(screen.getByText("No on-chain deprecation yet")).toBeInTheDocument();
  });

  it("renders Run again CTA as a button", async () => {
    const { Footer } = await loadShell();
    render(<Footer />);
    const cta = screen.getByTestId("run-again");
    expect(cta).toBeInTheDocument();
    expect(cta.tagName).toBe("BUTTON");
    expect(cta).toHaveAttribute("type", "button");
    expect(cta).toHaveTextContent("Run again");
  });

  it("renders truncated TxHashChip + Base Sepolia explorer link when state has a deprecation record", async () => {
    const { store, Footer } = await loadShell();
    const txHash = "0x" + "a".repeat(64);
    store.receive({
      type: "log_entry",
      runtimeId: "operator",
      level: "info",
      message: `WalletsDeprecated emitted at ${txHash}`,
      timestamp: Date.now(),
    });

    render(<Footer />);

    // truncated 0x{first6}…{last4}
    expect(screen.getByText(/0xaaaaaa…aaaa/)).toBeInTheDocument();

    // explorer link
    const link = screen.getByRole("link", { name: /View on Base Sepolia/i });
    expect(link).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${txHash}`);
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(link).toHaveAttribute("target", "_blank");
  });
});
