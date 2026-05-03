import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RuntimeNode } from "../components/canvas/RuntimeNode.js";
import type { RuntimeView } from "../state/reducer.js";

function rv(over: Partial<RuntimeView> = {}): RuntimeView {
  return {
    id: "alpha",
    pubkey: null,
    status: "registered",
    lastEventAt: null,
    walletAddress: null,
    walletAssignedAt: null,
    attackedAt: null,
    ...over,
  };
}

describe("RuntimeNode", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders the runtime name in uppercase (ALPHA)", () => {
    render(<RuntimeNode runtime={rv({ id: "alpha" })} />);
    expect(screen.getByText("ALPHA")).toBeInTheDocument();
  });

  it("renders BETA, GAMMA, ALPHA-CLONE in uppercase", () => {
    const { rerender } = render(<RuntimeNode runtime={rv({ id: "beta" })} />);
    expect(screen.getByText("BETA")).toBeInTheDocument();
    rerender(<RuntimeNode runtime={rv({ id: "gamma" })} />);
    expect(screen.getByText("GAMMA")).toBeInTheDocument();
    rerender(<RuntimeNode runtime={rv({ id: "alpha-clone" })} />);
    expect(screen.getByText("ALPHA-CLONE")).toBeInTheDocument();
  });

  it("renders the StatusPill with the current status text", () => {
    render(<RuntimeNode runtime={rv({ status: "awaiting" })} />);
    expect(screen.getByText("awaiting")).toBeInTheDocument();
  });

  it("with a 64-char pubkey, IdentityStrip shows 4..4 truncated form", () => {
    const pubkey = "abcd" + "f".repeat(56) + "z123"; // 64 chars
    render(<RuntimeNode runtime={rv({ pubkey })} />);
    const strip = screen.getByTestId("identity-strip-key");
    expect(strip.textContent).toBe("abcd…z123");
  });

  it("with pubkey=null, IdentityStrip shows em-dash", () => {
    render(<RuntimeNode runtime={rv({ pubkey: null })} />);
    const strip = screen.getByTestId("identity-strip-key");
    expect(strip.textContent).toBe("—");
  });

  it("alpha-clone with status='clone-rejected' has clone-rejected class on node", () => {
    const { container } = render(
      <RuntimeNode runtime={rv({ id: "alpha-clone", status: "clone-rejected" })} />,
    );
    const node = container.querySelector(".runtime-node--clone-rejected");
    expect(node).not.toBeNull();
  });

  it("alpha-clone has the ghost class at idle (status=registered)", () => {
    const { container } = render(<RuntimeNode runtime={rv({ id: "alpha-clone" })} />);
    expect(container.querySelector(".runtime-node--ghost")).not.toBeNull();
  });
});
