# @limbus/engine

Pure functions for Limbus Company clash and damage math. No I/O, no DOM.

## Entry points

- `resolveCombatant(self, opponent?)`: unit + skill + player-entered state to flat numbers.
- `clashChain(a, b)`: exact win/lose/draw and coins-left distribution for a clash.
- `attackDamageDistribution(params)`: exact total-damage distribution for a one-sided attack.
- `clashReport(a, b)` / `unopposedReport(a, b)`: the above combined, with a modifier breakdown.
- `matchupGrid(team, wave)`: every attack skill on my team against every enemy unit.

## Sources

- Damage formula: https://blog.limbus.wiki/docs/damage_formula/
- Clash and coin mechanics: https://limbuscompany.wiki.gg/wiki/Battles

## Known simplifications (v1)

- Parry bonus uses the expected parry round count, not its distribution.
- The 99-parry-round draw cap is not modeled; only a guaranteed tie yields a draw.
- Stagger mid-attack is on by default; pass `{ staggerMidAttack: false }` to disable.
- Evade skills, guard clashes, multi-target attack weight, and ally-targeted effects are not modeled.
- Guard, evade, and non-damaging skills report zero damage; the guard clash itself is not modeled until Plan 3.
