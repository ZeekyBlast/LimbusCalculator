import { describe, it, expect } from "vitest";
import {
    clampAilmentValue,
    resolveBleedTrigger,
    resolveBurnTrigger,
    resolveRuptureTrigger,
    resolveBleedThroughRounds,
    resolveRuptureOverHits,
} from "./fixedDamageAilment";

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

describe("resolveBleedThroughRounds", () => {
    it("triggers once per active coin each round, decrementing Count across the whole clash", () => {
        // Side "a" starts with 3 coins, loses one in round 1 (2 remaining), wins round 2 (still 2), loses round 3 (1 remaining).
        const rounds = [
            { aCoinsRemaining: 2, bCoinsRemaining: 3 },
            { aCoinsRemaining: 2, bCoinsRemaining: 2 },
            { aCoinsRemaining: 1, bCoinsRemaining: 2 },
        ];
        const { totalDamage, nextState } = resolveBleedThroughRounds(rounds, 3, "a", { potency: 10, count: 99 });
        // Active coins per round for "a": round 1 = initial 3, round 2 = 2 (post round-1), round 3 = 2 (post round-2) = 7 triggers.
        expect(totalDamage).toBe(70);
        expect(nextState.count).toBe(92);
    });

    it("stops once Count runs out mid-clash instead of going negative", () => {
        const rounds = [{ aCoinsRemaining: 1, bCoinsRemaining: 1 }, { aCoinsRemaining: 0, bCoinsRemaining: 1 }];
        const { totalDamage, nextState } = resolveBleedThroughRounds(rounds, 2, "a", { potency: 5, count: 2 });
        // Round 1 has 2 active coins but only 2 Count available; round 2 has 1 active coin but Count is already 0.
        expect(totalDamage).toBe(10);
        expect(nextState.count).toBe(0);
    });
});

describe("resolveRuptureOverHits", () => {
    it("triggers once per hit, heads or tails", () => {
        const { totalDamage, nextState } = resolveRuptureOverHits(4, { potency: 8, count: 10 });
        expect(totalDamage).toBe(32);
        expect(nextState.count).toBe(6);
    });

    it("caps at remaining Count when hits exceed it", () => {
        const { totalDamage, nextState } = resolveRuptureOverHits(10, { potency: 8, count: 3 });
        expect(totalDamage).toBe(24);
        expect(nextState.count).toBe(0);
    });
});
