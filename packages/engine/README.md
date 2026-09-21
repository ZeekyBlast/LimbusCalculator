# @limbus/engine

Pure functions for Limbus Company clash and damage math. No I/O, no DOM.

## Entry points

- `resolveCombatant(self, opponent?)`: unit + skill + player-entered state to flat numbers.
- `clashChain(a, b)`: exact win/lose/draw and coins-left distribution for a clash.
- `attackDamageDistribution(params)`: exact total-damage distribution for a one-sided attack.
- `clashReport(a, b)` / `unopposedReport(a, b)`: the above combined, with a modifier breakdown.
- `sampleClash(a, b, options?, rng?, report?)`: one random clash outcome plus one exact damage path, for coin-by-coin reveals.
- `matchupGrid(team, wave)`: every attack skill on my team against every enemy unit.
- `resolveCombatant` returns `statusAfterPrepare` (both sides after every pre-clash grant), `coinEffects`, `conditionalBonuses`, `grants` and the effect-line lists `effectsApplied` / `effectsPerCoin` / `effectsPending` / `effectsUnparsed`.
- Every `DamageSummary` carries `statusAfter`: expected statuses on both sides after the attack (`self` = attacker), with `varies` naming the ids that differ between paths. `damageDealt.statusAfter` is the win branch from A's view; `damageTaken.statusAfter` the lose branch from B's view. `perCoinMean` is indexed by original coin; a coin that broke in the clash contributes 0.

## Sources

- Damage formula: https://blog.limbus.wiki/docs/damage_formula/
- Clash and coin mechanics: https://limbuscompany.wiki.gg/wiki/Battles
- Rupture: https://limbuscompany.wiki.gg/wiki/Rupture ("When hit by an attack, take fixed damage by the effect's Potency. Then, reduce its Count by 1.")
- Poise: https://limbuscompany.wiki.gg/wiki/Poise (crit chance = Potency x 5%, one Count per crit, x1.2 damage)
- Status arithmetic: https://limbuscompany.wiki.gg/wiki/Status_Effects and namu.wiki/w/Limbus Company/키워드 (a potency grant to an absent status sets count 1; a count grant sets potency 1; cap 99)
- Effect resolution order (community guide, not the wiki): https://steamcommunity.com/sharedfiles/filedetails/?id=3003880251, "Skill Effect Order Clarification" and "The Order of Actions & Triggers"

## Known simplifications (v1)

- Parry bonus uses the expected parry round count, not its distribution.
- The 99-parry-round draw cap is not modeled round by round; only a guaranteed tie yields a draw, and it reports the 99-round cap as its expected parry rounds.
- Stagger mid-attack is on by default; pass `{ staggerMidAttack: false }` to disable.
- Evade skills, multi-target attack weight, and ally-targeted effects are not modeled.
- Effects are applied when the game applies them: pre-clash grants and unconditional flat ops at prepare; [Clash Win] / [Clash Lose] lines on that branch; per-coin lines coin by coin with [Heads Hit] / [Tails Hit] / [On Crit] gating; [Attack End] after the last coin. Rupture ticks as unscaled fixed damage on every landing coin; Poise, Fragile, Damage Up and the coin-roll statuses are read from the working status before each coin.
- Two rules come from a community guide rather than the wiki and are flagged as such in the code: untagged conditional lines are standing conditions re-evaluated after grants and before every coin (not resolved in text order), and breakable coins break lowest first, so a partial clash win attacks with the highest-indexed breakable coins plus every Unbreakable one; a broken coin's effects never fire.
- Every coin of a one-sided attack lands: on-hit grants assume no evasion.
- Statuses without in-attack arithmetic (Bleed, Burn, Sinking, Tremor, Charge, Bind, …) are updated by grants and reported in `statusAfter`, never applied.
- A coin's contribution to accumulated heads power is the Coin Power in force when it flipped; a standing condition that switches on mid-attack does not rewrite earlier coins.
- A coin whose roll a guard fully absorbed still lands: its hit effects fire and Rupture ticks.
- [Clash Lose] flat ops are listed but not applied (the losing skill never attacks).
- Guard clash (spec 6.2) is one round: the guard's level bonus uses its Defense Level, ties re-roll,
  and when the guard loses its final power is taken off the attack's coin rolls earliest coin first
  (a fully absorbed coin deals 0). The guard itself deals no damage. Evade skills still use the
  ordinary multi-round chain.
- Type- and sin-scoped statuses (Fragile (Slash), Damage Up (Pride), ...) count only for a matching
  attacking skill; with no opponent known every variant counts.

## Data contract notes

- `Skill.uptie` overrides apply from their tier UPWARD until a higher tier overrides them: the
  value listed for tier t is what the skill has at t, t+1, ... until the next override. This is the
  inverse of the retained legacy `resolveUptie` helper, whose base value is Uptie 4 and whose
  overrides apply downward. Plan 2's scraper must emit the new convention.
