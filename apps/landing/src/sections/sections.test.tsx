import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProblemSection } from "./ProblemSection";
import { ApproachSection } from "./ApproachSection";
import { DemoCtaSection } from "./DemoCtaSection";

describe("Sections — locked copy", () => {
  it("ProblemSection contains locked headline + body", () => {
    render(<ProblemSection />);
    expect(
      screen.getByText("Your agent is a liability with the keys."),
    ).toBeInTheDocument();
    expect(screen.getByText(/OWASP LLM06 names it/)).toBeInTheDocument();
  });

  it("ApproachSection contains locked headline + diagram svg", () => {
    const { container } = render(<ApproachSection />);
    expect(
      screen.getByText("Ping the fleet. Only the real one echoes back."),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("ApproachSection FlowDiagram contains all six labels", () => {
    render(<ApproachSection />);
    for (const label of [
      "Prompt",
      "Agent (Claude)",
      "Sonar MCP",
      "KeeperHub",
      "Operator",
      "Runtime",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("DemoCtaSection contains primary + secondary CTA + testnet note", () => {
    render(<DemoCtaSection />);
    expect(screen.getByText("Watch the 90s demo")).toBeInTheDocument();
    expect(screen.getByText("Read the source")).toBeInTheDocument();
    expect(screen.getByText("Base Sepolia testnet only")).toBeInTheDocument();
  });

  it("DemoCtaSection primary CTA href falls back to #demo when env unset", () => {
    render(<DemoCtaSection />);
    const cta = screen.getByText("Watch the 90s demo");
    // VITE_DEMO_VIDEO_URL is unset in tests → fallback "#demo"
    expect(cta).toHaveAttribute("href", "#demo");
  });
});

describe("Sections — banned words", () => {
  it("contains no banned marketing/imprecise terms across sections", () => {
    const { container } = render(
      <>
        <ProblemSection />
        <ApproachSection />
        <DemoCtaSection />
      </>,
    );
    const text = (container.textContent ?? "").toLowerCase();
    for (const banned of [
      "revolutionary",
      "seamless",
      "unleash",
      "ai agent",
      "blockchain",
    ]) {
      expect(text).not.toContain(banned);
    }
  });
});
