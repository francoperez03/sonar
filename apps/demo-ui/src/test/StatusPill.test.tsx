import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusPill } from "../components/primitives/StatusPill.js";
import type { RuntimeStatus } from "../state/reducer.js";

const ALL_STATUSES: RuntimeStatus[] = [
  "registered",
  "awaiting",
  "received",
  "deprecated",
  "revoked",
  "clone-rejected",
];

describe("StatusPill", () => {
  beforeEach(() => {
    cleanup();
  });

  for (const status of ALL_STATUSES) {
    it(`renders the verbatim lowercase label for status="${status}"`, () => {
      const { container } = render(<StatusPill status={status} />);
      // text content match; AnimatePresence may animate, but the text is in the DOM
      expect(container.textContent ?? "").toContain(status);
    });

    it(`applies status-pill--${status} class`, () => {
      const { container } = render(<StatusPill status={status} />);
      const el = container.querySelector(`.status-pill--${status}`);
      expect(el).not.toBeNull();
    });
  }

  it("re-renders the new label when status prop changes", async () => {
    const { rerender } = render(<StatusPill status="registered" />);
    expect(screen.getByText("registered")).toBeInTheDocument();
    rerender(<StatusPill status="awaiting" />);
    // AnimatePresence mode="wait" exits the old node before mounting the new
    // one; in jsdom the exit transition resolves on the next tick.
    expect(await screen.findByText("awaiting")).toBeInTheDocument();
  });
});
