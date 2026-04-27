import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NodeBadge } from "../badges/NodeBadge";
import { NODES, LOOP_SECONDS, OUTGOING_END, ECHO_END } from "./nodes";

describe("nodes.ts contract", () => {
  it("declares ALPHA, BETA, GAMMA in order with locked hitAt values", () => {
    expect(NODES.map((n) => n.id)).toEqual(["ALPHA", "BETA", "GAMMA"]);
    expect(NODES.map((n) => n.hitAt)).toEqual([0.4, 0.65, 0.85]);
  });

  it("locks loop timing to 2.4 / 1.2 / 2.2 seconds", () => {
    expect(LOOP_SECONDS).toBe(2.4);
    expect(OUTGOING_END).toBe(1.2);
    expect(ECHO_END).toBe(2.2);
  });

  it("exposes overlay coordinates for every node", () => {
    for (const n of NODES) {
      expect(n.overlay.left).toMatch(/%$/);
      expect(n.overlay.top).toMatch(/%$/);
    }
  });
});

describe("NodeBadge", () => {
  it("renders the label uppercase and accepts positional style", () => {
    render(<NodeBadge label="ALPHA" style={{ left: "22%", top: "62%" }} />);
    const el = screen.getByText("ALPHA");
    expect(el).toBeInTheDocument();
    expect(el.tagName).toBe("SPAN");
  });
});
