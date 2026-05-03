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

  it("ApproachSection FlowDiagram contains the rotation map labels", () => {
    render(<ApproachSection />);
    for (const label of [
      "Prompt",
      "Agent",
      "Sonar MCP",
      "KeeperHub",
      "Sonar",
      "Runtime",
      "alpha",
      "beta",
      "gamma",
      "gamma-clone",
      "generate",
      "fund",
      "distribute",
      "deprecate",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("DemoCtaSection contains primary + secondary CTAs as live links", () => {
    render(<DemoCtaSection />);
    const primary = screen.getByText("Open the live demo").closest("a");
    const secondary = screen.getByText("Go to GitHub").closest("a");
    expect(primary).toHaveAttribute("href", "https://sonar-demo-ui.vercel.app/");
    expect(secondary).toHaveAttribute(
      "href",
      "https://github.com/francoperez03/sonar",
    );
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
