import { describe, it, expect } from "vitest";
import { clampAilmentValue, resolveBleedTrigger, resolveBurnTrigger, resolveRuptureTrigger } from "./fixedDamageAilment";

describe("clampAilmentValue", () => {
    it("clamps to [0, 99]", () => {
        expect(clampAilmentValue(150)).toBe(99);
        expect(clampAilmentValue(-5)).toBe(0);
        expect(clampAilmentValue(42)).toBe(42);
    });
});

describe("resolveBleedTrigger", () => {
    it("deals fixed damage equal to Potency and decrements Count by 1", () => {
        const { damage, nextState } = resolveBleedTrigger({ potency: 20, count: 5 });
        expect(damage).toBe(20);
        expect(nextState).toEqual({ potency: 20, count: 4 });
    });

    it("deals 0 damage once Count reaches 0 (no-op, does not go negative)", () => {
        const { damage, nextState } = resolveBleedTrigger({ potency: 20, count: 0 });
        expect(damage).toBe(0);
        expect(nextState).toEqual({ potency: 20, count: 0 });
    });

    it("supports the wiki's own worked example (3 skills x 5 clashes x 99 potency = 1485)", () => {
        let state = { potency: 99, count: 99 };
        let total = 0;
        for (let i = 0; i < 15; i++) {
            const { damage, nextState } = resolveBleedTrigger(state);
            total += damage;
            state = nextState;
        }
        expect(total).toBe(1485);
        expect(state.count).toBe(84);
    });
});

describe("resolveBurnTrigger", () => {
    it("deals fixed damage equal to Potency and decrements Count by 1, same as Bleed", () => {
        const { damage, nextState } = resolveBurnTrigger({ potency: 15, count: 3 });
        expect(damage).toBe(15);
        expect(nextState).toEqual({ potency: 15, count: 2 });
    });

    it("caps at 99/turn even at max Potency and Count (only meant to be called once per Turn End)", () => {
        const { damage } = resolveBurnTrigger({ potency: 99, count: 99 });
        expect(damage).toBe(99);
    });
});

describe("resolveRuptureTrigger", () => {
    it("deals fixed damage equal to Potency and decrements Count by 1, same as Bleed/Burn", () => {
        const { damage, nextState } = resolveRuptureTrigger({ potency: 30, count: 10 });
        expect(damage).toBe(30);
        expect(nextState).toEqual({ potency: 30, count: 9 });
    });

    it("supports the wiki's own worked example (6 units x 2 coins x 99 potency = 1188 per turn)", () => {
        let total = 0;
        for (let unit = 0; unit < 6; unit++) {
            let state = { potency: 99, count: 99 };
            for (let coin = 0; coin < 2; coin++) {
                const { damage, nextState } = resolveRuptureTrigger(state);
                total += damage;
                state = nextState;
            }
        }
        expect(total).toBe(1188);
    });
});
