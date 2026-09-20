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
 *
 * Unbreakable Coin (limbuscompany.wiki.gg's Status Effects page): "This Coin does not break
 * upon Clash Lose... Upon Clash Lose, fix the Coin Power of the unbroken Coin to 1." Cracked
 * Unbreakable Coins "trigger after losing a Clash (in a similar manner to Counter Skills), but
 * with their Coin Power fixed to 1." So a side's *breakable* coins are what determine when it
 * loses the clash - unbreakable coins keep flipping every round but are never removed. Once a
 * side's breakable coins hit 0, the clash ends there; any remaining unbreakable coins on that
 * side are reported as "cracked" rather than zeroed. The cracked-coin counter-attack itself
 * (its exact trigger/damage resolution isn't documented anywhere found) is NOT modeled here -
 * only the coin-pool/win-condition mechanic, which is fully sourced above.
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
    /** Total coins, including any unbreakable ones counted in unbreakableCoinCount. */
    coinCount: number;
    /** Subset of coinCount that's Unbreakable - never removed on a lost round. Defaults to 0. */
    unbreakableCoinCount?: number;
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
    /** Unbreakable coins still active on the loser when its breakable coins ran out. 0 for a draw. */
    crackedCoins: number;
}

export function simulateClash(a: ClashCombatant, b: ClashCombatant, rng: () => number = Math.random): ClashResult {
    const aChance = headsChance(a.sanityPoints ?? 0);
    const bChance = headsChance(b.sanityPoints ?? 0);
    const aLevelBonus = clashPowerLevelBonus(a.level, b.level);
    const bLevelBonus = clashPowerLevelBonus(b.level, a.level);

    let aUnbreakableRemaining = a.unbreakableCoinCount ?? 0;
    let bUnbreakableRemaining = b.unbreakableCoinCount ?? 0;
    let aBreakableRemaining = a.coinCount - aUnbreakableRemaining;
    let bBreakableRemaining = b.coinCount - bUnbreakableRemaining;
    let parryRounds = 0;

    const rounds: ClashRoundResult[] = [];

    for (let round = 1; aBreakableRemaining > 0 && bBreakableRemaining > 0; round++) {
        const aActive = aBreakableRemaining + aUnbreakableRemaining;
        const bActive = bBreakableRemaining + bUnbreakableRemaining;
        const aHeads = flipCoins(aActive, aChance, rng);
        const bHeads = flipCoins(bActive, bChance, rng);
        const aPower = a.basePower + aLevelBonus + aHeads * a.coinPower;
        const bPower = b.basePower + bLevelBonus + bHeads * b.coinPower;

        const tie = aPower === bPower;
        if (tie) {
            parryRounds++;
        } else if (aPower < bPower) {
            aBreakableRemaining--;
        } else {
            bBreakableRemaining--;
        }

        rounds.push({
            round,
            aHeads,
            bHeads,
            aPower,
            bPower,
            aCoinsRemaining: aBreakableRemaining + aUnbreakableRemaining,
            bCoinsRemaining: bBreakableRemaining + bUnbreakableRemaining,
            tie,
        });

        if (parryRounds >= MAX_PARRY_ROUNDS) {
            return { rounds, winner: "draw", winnerCoinsRemaining: 0, parryRounds, crackedCoins: 0 };
        }
    }

    const winner = aBreakableRemaining > 0 ? "a" : "b";
    const winnerCoinsRemaining = winner === "a" ? aBreakableRemaining + aUnbreakableRemaining : bBreakableRemaining + bUnbreakableRemaining;
    const crackedCoins = winner === "a" ? bUnbreakableRemaining : aUnbreakableRemaining;

    return { rounds, winner, winnerCoinsRemaining, parryRounds, crackedCoins };
}
