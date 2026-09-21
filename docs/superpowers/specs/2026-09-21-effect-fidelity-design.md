# Effect Fidelity: Design

Date: 2026-09-21. Follows the rebuild design (`2026-09-20-limbus-calculator-rebuild-design.md`), whose Plans 1 to 3 are merged.

## 1. Problem

The scraper turns skill text into structured `Effect` records, and 2,805 of 7,339 lines parse. The engine, however, only honours skill-level effects with the triggers `on-use`, `combat-start` and `passive`, and only when their operation changes a flat number. Everything else is thrown away:

- 1,968 parsed per-coin lines (1,917 status grants such as "[On Hit] Inflict 2 Rupture", 51 per-coin power or damage ops) are reported as unmodeled.
- 531 parsed skill-level status grants ("[On Use] Gain +2 Poise Count", "[Clash Win] Gain 3 Poise") are skipped.
- Ailments entered in the status editor are inert counters; a target with Rupture takes no extra damage.

The calculator therefore undersells crit build-up mid-attack and every ailment a skill inflicts, in a product whose first principle is that the numbers are right.

## 2. Goals

- The engine applies every parsed effect at the moment the game applies it, exactly, without new approximation.
- Rupture is modeled as an in-attack mechanic; Poise, Fragile, Damage Up and the coin-roll and coin-power statuses already in the registry take their grants into account coin by coin.
- Reports state what a skill leaves behind on both sides after the clash, so ailments that act on later turns are still visible.
- The effect list distinguishes "applied", "applied on coin N", "applied later" and "not modeled" truthfully.
- No change to the data package, its outputs, or the output gate.

## 3. Non-goals

- Parsing more phrasings (the grammar is unchanged; coverage stays 38.2%).
- Passives beyond their current treatment.
- Cross-turn mechanics: Bleed (triggers when the bleeding unit attacks), Burn and Sinking (turn end, SP), Tremor (stagger threshold on burst), Charge, Ammo, Reuse, and any status without a formula in the registry. They are tracked and reported, never applied.
- Modeling the target's own on-hit effects against the attacker (counters).

## 4. Rules from the wiki (cited in code comments)

- Rupture (limbuscompany.wiki.gg/wiki/Rupture): "When hit by an attack, take fixed damage by the effect's Potency. Then, reduce its Count by 1. Maximum value of 99 potency & Count."
- Poise (limbuscompany.wiki.gg/wiki/Poise): crit chance = potency × 5%; on a successful crit reduce Count by 1; critical hits deal 1.2× damage. Consumed per coin. Already implemented; unchanged.
- Fragile (limbuscompany.wiki.gg/wiki/Fragile): damage taken +10% per stack, max 10; the sin and damage-type variants gate on the attacking skill. Already implemented as the dynamic modifier; unchanged.
- Status arithmetic (limbuscompany.wiki.gg/wiki/Status_Effects; namu.wiki/w/Limbus Company/키워드: "아무것도 없을 때 부여를 하면 횟수 1, 횟수 증가를 하면 위력 1로 적용된다"): two-value statuses carry potency and count; default max 99. Rule adopted: a potency grant adds potency and, if the status was absent, sets count to 1; a count grant adds count and, if the status was absent, sets potency to 1; both clamp to [0, 99]; a status whose count reaches 0 is removed.
- Untagged conditional lines are standing conditions (Steam guide "Limbus Company: Beginner / Intermediate / Advanced Strategy Guide", section "Skill Effect Order Clarification", steamcommunity.com/sharedfiles/filedetails/?id=3003880251): "effects that aren't on a coin and don't have an activation marker apply to the entire skill ... they can activate in the middle of skill usage if/when their conditions are met", with the example of W Corp Ryōshū reaching 12 Charge on use and clashing with the +1 Coin Power already active, and "this can also happen literally in the middle of an attack move". Community source, not the wiki; recorded as such in the engine README.
- Coins break lowest to highest in a clash and a broken coin's effects never fire (same guide: "If the coin was broken, the effect will not take place (coins break from lowest to highest)"; "If you have a 3 coin skill and 2 coins are broken clashing, only the [on hit] effects of coin 3 will trigger"). Community source, recorded as such.

## 5. Effect application order

All rules below act on a working copy of the entered status, per side, per path.

1. **Before the clash** (`prepareCombatant`): skill-level `on-use` and `combat-start` grants, then passive grants, apply to the working status (their relative order does not matter; grants only accumulate). Then every skill-level line whose op changes a flat number (`coinPower`, `basePower`, `clashPower`, `damagePercent`) is evaluated: unconditional ones always apply; conditional ones apply when their condition holds against the working status after those grants. Conditional lines are standing conditions and are re-evaluated in step 3 before each coin, so a grant landed mid-attack can switch a bonus on for the coins that follow. Per-coin lines are collected per coin index for step 3 and are not applied here.
2. **After the clash is decided** (`clashReport`): on the branch where side X wins, X's skill-level `clash-win` grants apply to the working statuses; the loser's `clash-lose` grants apply likewise. The attack then runs with those statuses. The unopposed report applies neither.
3. **During the attack** (`attackDamageDistribution` / `sampleAttack`). The attack uses the coins that survived the clash: every Unbreakable coin plus the highest-indexed breakable coins, since breakable coins break lowest first; a broken coin contributes neither its roll nor its effects. Rolls accumulate over the surviving coins in index order. For each surviving coin i:
   1. Re-evaluate the skill-level conditional bonuses against the current working status (a Poise or Charge gain from an earlier coin can switch them on); apply coin i's own `coinPower` and `damagePercent` ops to this coin's roll and dynamic modifier.
   2. Compute the coin's damage with the dynamic modifier read from the current stacks (Damage Up family on the attacker, Fragile family on the target), using the existing registry functions.
   3. Land the coin: if the target has Rupture with count ≥ 1, add its potency as fixed damage (not scaled by any modifier, but counted toward the stagger lines like any other damage) and reduce its count by 1; if the coin crit, reduce the attacker's Poise count by 1 (existing rule).
   4. Apply coin i's grants: `on-hit` always (every coin of a one-sided attack lands); `heads-hit` or `tails-hit` by the flip; `on-crit` if it crit. Grants to self and target update the respective working status.
4. **Attack end**: skill-level `attack-end` grants apply after the last coin and appear only in the leftover statuses.

Statuses without in-attack arithmetic (Bleed, Burn, Sinking, Tremor, Charge, Bind, Paralyze, level changes, anything unknown) are updated by grants and reported, never applied.

## 6. Engine shapes

- `StatusState = Record<string, { potency: number; count: number }>` (the existing `Combatant.status` shape).
- `prepareCombatant(self, opponent?)` replaces the body of `resolveCombatant`; `resolveCombatant` remains as the public name and returns `ResolvedCombatant` plus two new fields: `statusAfterPrepare: { self: StatusState; target: StatusState }` and `coinEffects: Effect[][]` (index = coin, at the resolved uptie). `effectsApplied` keeps its meaning; parsed per-coin effects move from `effectsUnparsed` to a new `effectsPerCoin: string[]`; `effectsPending: string[]` lists parsed skill-level lines that only act after this clash (`attack-end`, grants of inert statuses).
- `AttackParams` gains `status: { self: StatusState; target: StatusState }`, `coinEffects: Effect[][]` (indexed by original coin), `conditionalBonuses: Effect[]` (the skill-level conditional flat-number lines, re-evaluated per coin), `unbreakableCoins: number[]` and `attackerSkill: { damageType; sin }`. `coins` keeps its meaning (how many coins attack); the walk derives the surviving coin indices from `coins`, the total coin count and `unbreakableCoins`. The walk state carries a per-path copy of `status`. `DamageSummary.perCoinMean` and `SampledCoin` report by original coin index (a report after a partial clash win may show coins 2 and 3 and no coin 1).
- `DamageSummary` gains `statusAfter: { self: StatusState; target: StatusState; varies: string[] }`: expected potency and count over the paths, weighted like the histogram; `varies` lists ids whose value differs between paths.
- `ClashReport` and `UnopposedReport` expose `statusAfter` from the damage stage (the win-branch statuses for `damageDealt`, the lose-branch for `damageTaken`).
- `SampledCoin` gains `rupture: number` (fixed damage added by the tick) and `grants: string[]` (sources applied on that coin).
- The registry gains `poise` (slot `poise`) and `rupture` (slot `ailment-rupture`), both `formulaStatus: 'verified'` with the wiki citations; no other registry entry changes.

## 7. Web app

- Effect list marks: applied (gold), applied on coin N (gold, with the coin), applied later (dim, for `effectsPending`), not active (dim), not modeled (faint, for unparsed).
- Verdict slab: an "After this skill" block under the damage bands listing expected statuses for both sides (name, potency, count, "varies" when it does), rendered from `statusAfter` of the damage-dealt branch; Roll once shows per-coin Rupture damage and grants.
- Status editor: Poise and Rupture come from the registry like every other option.

## 8. Testing

Engine, closed form and hand-computed, all on top of the existing 166 tests which must pass unchanged:

- Poise mid-attack: 2 coins, "[On Hit] Gain 1 Poise" on coin 1 and no Poise entered; coin 1 never crits, coin 2 crits at 5%.
- Poise before the roll: "[On Use] Gain 2 Poise Count" with Poise potency 20 entered and count 0; both coins can crit.
- Standing condition: "At 5+ Poise on self, Coin Power +1" with "[On Use] Gain 5 Poise" on the same skill applies +1 regardless of line order; with "[On Hit] Gain 5 Poise" on coin 1 instead, coin 1 rolls without the bonus and coin 2 with it.
- Surviving coins: a 3-coin skill with "[On Hit] Inflict 3 Rupture" on coin 1 only, attacking with 2 coins after a clash, applies no Rupture (coin 1 broke) and reports per-coin means for coins 2 and 3; with coin 1 Unbreakable and 2 coins left, coins 1 and 3 attack.
- Rupture entered: target Rupture 5 count 1; coin 1 deals +5 fixed, coin 2 deals +0, `statusAfter.target.rupture` is absent.
- Rupture inflicted: "[On Hit] Inflict 3 Rupture" on coin 1 of a 2-coin skill; coin 2 deals +3; leftover Rupture potency 3 count 0 → removed, reported absent; with "+1 Rupture Count" also on coin 1, leftover is potency 3 count 1.
- Rupture is unscaled: with Fatal resistance the coin damage doubles but the tick does not.
- Clash-win grant: "[Clash Win] Gain 4 Poise" changes `damageDealt` but not `damageTaken`; the unopposed report ignores it.
- Per-coin power op: "coin 2: Coin Power +2" raises only coin 2's roll.
- Caps: a grant past 99 clamps; a status reaching count 0 disappears.
- Inert statuses: "[On Hit] Inflict 2 Bleed" changes no damage and appears in `statusAfter` with potency 2 count 1.
- Sampler: `sampleAttack` on a path with fixed rng reproduces the enumeration's per-coin numbers including the Rupture tick.
- Regression: a combatant with no parsed coin effects and no statuses yields byte-identical `DamageSummary` numbers to the pre-change engine on the existing fixtures.

Web: existing tests plus a pure test for the effect-mark classification with the new categories. No browser tests.

## 9. Open risks

- The standing-condition rule and the lowest-first coin-break order come from a community guide, not the wiki. Both are stated as such in the engine README with the citation.
- On-hit grants assume every coin lands, which holds for a one-sided attack against a target that cannot evade; Evade skills as the loser are not modeled as dodges.
- Expected leftover statuses average over paths; a user reading "Poise count 1.4" should see the `varies` flag, and the UI must show it.
