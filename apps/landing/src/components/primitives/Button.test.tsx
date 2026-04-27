import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders as <a> when href is provided", () => {
    render(
      <Button variant="primary" href="#demo">
        Watch the 90s demo
      </Button>,
    );
    const el = screen.getByText("Watch the 90s demo");
    expect(el.tagName).toBe("A");
    expect(el).toHaveAttribute("href", "#demo");
  });

  it("renders as <button> when href is absent", () => {
    render(<Button variant="secondary">Click</Button>);
    expect(screen.getByText("Click").tagName).toBe("BUTTON");
  });

  it("applies primary variant class", () => {
    const { container } = render(<Button variant="primary">x</Button>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("primary");
  });

  it("adds rel=noopener noreferrer for external http(s) hrefs", () => {
    render(
      <Button variant="secondary" href="https://github.com/francoperez03/sonar">
        Read
      </Button>,
    );
    const el = screen.getByText("Read");
    expect(el).toHaveAttribute("rel", "noopener noreferrer");
    expect(el).toHaveAttribute("target", "_blank");
  });
});
