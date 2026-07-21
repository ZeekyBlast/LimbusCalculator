/**
 * Clash resolution mechanic, from limbuscompany.wiki.gg's "Battles" page (not covered by
 * Syx's Limbus Blog, which only documents the post-clash damage-multiplier stage).
 *
 * Coin flip: Heads% = 50 + SP, where SP (Sanity Points) is clamped to [-45, 45].
 *
 * Clash round loop: each round, both sides re-flip their *entire remaining coin pool* fresh
 * (coins are not individually consumed one at a time). Round's Clash Power per side =
 * basePower + levelBonus + sum(coinPower for each coin that flipped heads this round). The
 * side with lower Clash Power loses exactly one coin from its remaining pool. Repeat until one
 * side has 0 coins left - that side loses the clash. Equal Clash Power is a "parry round":
 * neither side loses a coin (see formula/parryBonus.ts, which already models the resulting
 * damage bonus - this module only produces the round count that feeds it). Capped at 99 parry
 * rounds ("after that the Clash draws" - Syx's blog, in the parryBonus context).
 *
 * Level bonus is a flat, asymmetric bonus distinct from offenseDefenseAdvantage.ts's C(x)
 * damage multiplier: "the Skill with higher Level gains 1 Power per 3 Level difference,
 * rounded down" - only the higher side gains anything, the lower side gets no penalty.
 */

const MAX_PARRY_ROUNDS = 99;

export function headsChance(sanityPoints: number): number {
    const clamped = Math.min(Math.max(sanityPoints, -45), 45);
    return (50 + clamped) / 100;
}

export function flipCoins(count: number, chance: number, rng: () => number = Math.random): number {
    let heads = 0;
    for (let i = 0; i < count; i++) {
        if (rng() < chance) heads++;
    }
    return heads;
}

export function clashPowerLevelBonus(myLevel: number, otherLevel: number): number {
    return Math.max(0, Math.floor((myLevel - otherLevel) / 3));
}

export interface ClashCombatant {
    basePower: number;
    coinPower: number;
    coinCount: number;
    level: number;
    sanityPoints?: number;
}

export interface ClashRoundResult {
    round: number;
    aHeads: number;
    bHeads: number;
    aPower: number;
    bPower: number;
    aCoinsRemaining: number;
    bCoinsRemaining: number;
    tie: boolean;
}

export interface ClashResult {
    rounds: ClashRoundResult[];
    winner: "a" | "b" | "draw";
    winnerCoinsRemaining: number;
    parryRounds: number;
}

export function simulateClash(a: ClashCombatant, b: ClashCombatant, rng: () => number = Math.random): ClashResult {
    const aChance = headsChance(a.sanityPoints ?? 0);
    const bChance = headsChance(b.sanityPoints ?? 0);
    const aLevelBonus = clashPowerLevelBonus(a.level, b.level);
    const bLevelBonus = clashPowerLevelBonus(b.level, a.level);

    let aCoinsRemaining = a.coinCount;
    let bCoinsRemaining = b.coinCount;
    let parryRounds = 0;

    const rounds: ClashRoundResult[] = [];

    for (let round = 1; aCoinsRemaining > 0 && bCoinsRemaining > 0; round++) {
        const aHeads = flipCoins(aCoinsRemaining, aChance, rng);
        const bHeads = flipCoins(bCoinsRemaining, bChance, rng);
        const aPower = a.basePower + aLevelBonus + aHeads * a.coinPower;
        const bPower = b.basePower + bLevelBonus + bHeads * b.coinPower;

        const tie = aPower === bPower;
        if (tie) {
            parryRounds++;
        } else if (aPower < bPower) {
            aCoinsRemaining--;
        } else {
            bCoinsRemaining--;
        }

        rounds.push({ round, aHeads, bHeads, aPower, bPower, aCoinsRemaining, bCoinsRemaining, tie });

        if (parryRounds >= MAX_PARRY_ROUNDS) {
            return { rounds, winner: "draw", winnerCoinsRemaining: 0, parryRounds };
        }
    }

    const winner = aCoinsRemaining > 0 ? "a" : "b";
    const winnerCoinsRemaining = aCoinsRemaining > 0 ? aCoinsRemaining : bCoinsRemaining;

    return { rounds, winner, winnerCoinsRemaining, parryRounds };
}
