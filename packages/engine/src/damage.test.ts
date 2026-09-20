import { describe, it, expect } from "vitest";
import { computeFinalDamage, sumStaticModifiers, sumDynamicModifiers, type StaticModifiers, type DynamicModifiers } from "./damage";

const noStatic: StaticModifiers = {
    sinResistance: 0,
    damageTypeResistance: 0,
    offenseDefenseAdvantage: 0,
    parryBonus: 0,
    critical: 0,
};
const noDynamic: DynamicModifiers = { skillEffects: 0, buffs: 0 };

describe("sumStaticModifiers / sumDynamicModifiers", () => {
    it("sums all six static components (F defaults to 0)", () => {
        expect(sumStaticModifiers({ ...noStatic, sinResistance: 0.2, damageTypeResistance: 0.1 })).toBeCloseTo(0.3);
        expect(sumStaticModifiers({ ...noStatic, observationLevel: 0.05 })).toBeCloseTo(0.05);
    });

    it("sums both dynamic components", () => {
        expect(sumDynamicModifiers({ skillEffects: 0.2, buffs: -0.1 })).toBeCloseTo(0.1);
    });
});

describe("computeFinalDamage", () => {
    it("returns the raw coin roll when every modifier is neutral", () => {
        expect(computeFinalDamage({ coinRoll: 10, staticModifiers: noStatic, dynamicModifiers: noDynamic })).toBe(10);
    });

    it("scales up with a positive static sum (e.g. 200% sin weakness, A=+1)", () => {
        const result = computeFinalDamage({
            coinRoll: 10,
            staticModifiers: { ...noStatic, sinResistance: 1 },
            dynamicModifiers: noDynamic,
        });
        expect(result).toBe(20); // 10 * max(1+1, 0) * 1
    });

    it("scales down with a negative static sum (e.g. 0% sin resistance nullify, A=-0.5)", () => {
        const result = computeFinalDamage({
            coinRoll: 10,
            staticModifiers: { ...noStatic, sinResistance: -0.5 },
            dynamicModifiers: noDynamic,
        });
        expect(result).toBe(5); // 10 * max(1-0.5, 0) * 1
    });

    it("floors coin damage at 0 when static sum drops below -1, but the minimum-damage rule still applies", () => {
        const result = computeFinalDamage({
            coinRoll: 10,
            staticModifiers: { ...noStatic, sinResistance: -0.5, damageTypeResistance: -0.5, offenseDefenseAdvantage: -1 },
            dynamicModifiers: noDynamic,
        });
        // max(1 - 2, 0) = 0 -> coin damage 0, but Final Damage minimum is max(total, 1, 0.05*coinRoll) = max(0, 1, 0.5) = 1
        expect(result).toBe(1);
    });

    it("applies the 0.05*CoinRoll floor when it exceeds the flat minimum of 1", () => {
        const result = computeFinalDamage({
            coinRoll: 1000,
            staticModifiers: { ...noStatic, sinResistance: -0.5, damageTypeResistance: -0.5 },
            dynamicModifiers: noDynamic,
        });
        // max(1 - 1, 0) = 0 -> coin damage 0, minimum = max(0, 1, 0.05*1000=50) = 50
        expect(result).toBe(50);
    });

    it("applies dynamic modifiers as an additional multiplier on top of the static result", () => {
        const result = computeFinalDamage({
            coinRoll: 10,
            staticModifiers: noStatic,
            dynamicModifiers: { skillEffects: 0.5, buffs: 0 },
        });
        expect(result).toBe(15); // 10 * 1 * (1 + 0.5)
    });

    it("adds a floored Attack Adder multiplied by (1 + max(A+B+C, 0)) only", () => {
        const result = computeFinalDamage({
            coinRoll: 0,
            staticModifiers: { ...noStatic, sinResistance: 0.2, offenseDefenseAdvantage: 0.1 },
            dynamicModifiers: noDynamic,
            attackAdder: 100,
        });
        // adderAdvantage = 1 + max(0.2 + 0 + 0.1, 0) = 1.3 -> floor(100 * 1.3) = 130
        expect(result).toBe(130);
    });

    it("adds a floored Attack HP Adder with no multiplier at all", () => {
        const result = computeFinalDamage({
            coinRoll: 0,
            staticModifiers: noStatic,
            dynamicModifiers: noDynamic,
            attackHpAdder: 50.7,
        });
        expect(result).toBe(50);
    });

    it("rounds the final combined total down to an integer", () => {
        const result = computeFinalDamage({
            coinRoll: 7,
            staticModifiers: { ...noStatic, offenseDefenseAdvantage: 0.5 / 3 }, // deliberately non-integer-friendly
            dynamicModifiers: noDynamic,
        });
        expect(Number.isInteger(result)).toBe(true);
    });
});
