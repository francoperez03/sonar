import { describe, expect, it } from "vitest";
import { formatWeiAsEth } from "../state/useBalance.js";

describe("formatWeiAsEth", () => {
  it("keeps seven decimals so tiny funded balances are visible", () => {
    expect(formatWeiAsEth(1_000_000_000_000n)).toBe("0.0000010");
  });

  it("pads zero balances with the same precision", () => {
    expect(formatWeiAsEth(0n)).toBe("0.0000000");
  });
});
