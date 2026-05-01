import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { App } from "../App.js";

describe("demo-ui smoke", () => {
  it("renders the root container", () => {
    render(<App />);
    expect(screen.getByTestId("demo-ui-root")).toBeInTheDocument();
  });
  it("imports @sonar/shared without throwing", async () => {
    const shared = await import("@sonar/shared");
    expect(shared.Message).toBeDefined();
  });
});
