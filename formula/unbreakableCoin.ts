/**
 * Detects Unbreakable Coins from scraped skill data. `Skill.coinEffects[i]` (data/generated/
 * identities.json) is index-aligned with the coin at position i, and coins that are inherently
 * Unbreakable carry the literal tag text "Unbreakable Coin(s)" in their own entry (e.g. Gregor's
 * "Crack of Dawn" - all 4 coins; Faust's "Eject - High Noon" - coin 3 of 3).
 *
 * Deliberately narrow: only counts a coin's own inherent tag. Some skill effects instead GRANT
 * Unbreakable Coins dynamically (e.g. "gain Unbreakable Coins equal to The Middle Count") - that's
 * a conditional buff, not a fixed per-coin property, and isn't handled here.
 */
export function countUnbreakableCoins(coinEffects?: string[]): number {
    if (!coinEffects) return 0;
    return coinEffects.filter(text => /unbreakable coin/i.test(text)).length;
}
