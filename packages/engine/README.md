# @limbus/engine

Pure functions for Limbus Company clash and damage math. No I/O, no DOM.

## Entry points

- `resolveCombatant(self, opponent?)`: unit + skill + player-entered state to flat numbers.
- `clashChain(a, b)`: exact win/lose/draw and coins-left distribution for a clash.
- `attackDamageDistribution(params)`: exact total-damage distribution for a one-sided attack.
- `clashReport(a, b)` / `unopposedReport(a, b)`: the above combined, with a modifier breakdown.
- `sampleClash(a, b, options?, rng?, report?)`: one random clash outcome plus one exact damage path, for coin-by-coin reveals.
- `matchupGrid(team, wave)`: every attack skill on my team against every enemy unit.

## Sources

- Damage formula: https://blog.limbus.wiki/docs/damage_formula/
- Clash and coin mechanics: https://limbuscompany.wiki.gg/wiki/Battles

## Known simplifications (v1)

- Parry bonus uses the expected parry round count, not its distribution.
- The 99-parry-round draw cap is not modeled round by round; only a guaranteed tie yields a draw, and it reports the 99-round cap as its expected parry rounds.
- Stagger mid-attack is on by default; pass `{ staggerMidAttack: false }` to disable.
- Evade skills, guard clashes, multi-target attack weight, and ally-targeted effects are not modeled.
- Guard, evade, and non-damaging skills report zero damage; the guard clash itself is not modeled until Plan 3.
- Per-coin effects (`scope: { coin: n }`) are listed as unhandled and not applied.
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
