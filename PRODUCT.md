# Product

## Register

product

## Users

Limbus Company players who want to know what actually happens when two Skills clash - before committing to a turn in-game, or while theorycrafting a team. They're comparing specific Identities/Skills at specific Uptie tiers and levels, reading formula output (damage, clash rounds, coin-by-coin results), not browsing casually. Context is a desktop browser, focused single-session use.

## Product Purpose

A clash simulator and damage calculator for Limbus Company: pick an attacker and defender Identity + Skill, run the clash coin-by-coin with real randomness, and see who wins and what damage lands. Every number is reverse-engineered from verified sources (Syx's Limbus Blog for the damage formula, limbuscompany.wiki.gg for the clash mechanic) rather than guessed - correctness is the core value proposition, wrapped in a presentation that feels deliberately made rather than a bare dev tool.

## Brand Personality

Corporate, noir, precise. Dystopian-corporate-noir mood (the game's own tone, since Limbus Company's setting is literally a corporation) rendered as a case-file/ledger/ops-terminal aesthetic - stamped verdicts, tabular ledger-style numbers, restrained and confident motion spent only on genuinely significant moments (coin flip, damage reveal, win/loss stamp). Not flashy; reads as exact and procedural, like an internal ops report rather than a marketing page.

## Anti-references

Not a reskin of Limbus Company's own in-game UI or of either fan wiki's (limbuscompany.wiki.gg, libraryofruina.wiki.gg) visual theme - adjacent to the source material's DNA, not a copy of it. Not generic gothic-fantasy/ornate-Victorian-serif (an earlier direction explicitly rejected in favor of the game's actual clean-sans, dark/gold corporate-noir look). Not generic "dark gamer UI" either - restraint and precision over edginess.

## Design Principles

- **Correctness is the product.** Every displayed number must trace to a verified source (formula doc-comments cite Syx's blog or the wiki page); never fabricate or approximate to unblock a demo - an unverified stat is marked `tbd` and left inert rather than guessed.
- **Adjacent, not derivative.** Same tonal DNA as Limbus Company (dark, moody, corporate-noir) but a distinct visual identity - never a reskin of the game's or wiki's own UI.
- **Motion is restrained and earned.** Animation budget goes to the coin flip, damage reveal, and win/loss stamp - the moments that matter - not ambient decoration elsewhere.
- **Real data over placeholders.** Prefer wiring actual scraped identity/skill/status-effect data over mock values, even mid-build; the picker, dropdowns, and effect text should reflect what the wiki actually says.
- **Legible under load.** This app surfaces dense information (skill effects, coin math, resistances) - hierarchy, spacing, and collapsible detail exist so density doesn't become clutter.

## Accessibility & Inclusion

Standard WCAG AA contrast targets across the palette (ink/paper/gold/blood/bone tokens). `prefers-reduced-motion: reduce` is respected by all signature animations (`.stamp`, `.coin-flip`, the landing page's looping coin-flip hero, the Uptie 4 border cycle). No additional accessibility requirements specified beyond these at this time.
