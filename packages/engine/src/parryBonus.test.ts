import { describe, it, expect } from "vitest";
import { parryRoundBonus } from "./parryBonus";

describe("parryRoundBonus", () => {
    it("gives +0.03 per round", () => {
        expect(parryRoundBonus(1)).toBeCloseTo(0.03);
        expect(parryRoundBonus(5)).toBeCloseTo(0.15);
    });

    it("is 0 for 0 rounds", () => {
        expect(parryRoundBonus(0)).toBe(0);
    });

    it("caps at 99 stacks", () => {
        expect(parryRoundBonus(99)).toBeCloseTo(2.97);
        expect(parryRoundBonus(150)).toBeCloseTo(2.97);
    });

    it("clamps negative rounds to 0", () => {
        expect(parryRoundBonus(-5)).toBe(0);
    });
});
