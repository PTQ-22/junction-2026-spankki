# Taimi — money garden coach

A single, production-flavoured direction for the S-Pankki "Money Garden"
challenge at Junction 2026: **the garden IS the interface**. A calm Nordic
landscape (spruce forest, a lake strip, a wooden rail, a meadow) mirrors the
user's money state; Taimi — a small growing plant — is the companion whose
growth stage is the user's progress. Playful but adult; almost no decoration,
very little text.

Standalone prototype. `prototype/garden/` and `prototype/ui-concepts/` are
untouched predecessors; this folder does not depend on them at runtime
(persona data is inlined verbatim from `./persona-data.json`, itself copied
verbatim from `prototype/garden/persona-data.json`).

## Provenance

Evolved from `prototype/ui-concepts` concept 11 "Taimi" after two rounds of
feedback: the habit-app direction worked, but the first version copied its
reference too literally (bulb character, crown, sneakers, picket fence,
level bar, candy tiles) and read as a children's game. v2 keeps the idea —
a living scene + a companion + minimal chrome — and redesigns every element
toward something S-Pankki could ship inside S-mobiili for adults 18–35.

Removed by decree: crown, sneakers, cheeks/open-mouth smile, church,
scarecrow, cactus, white picket fence, "Level N" game bar, Shop/My-items
tiles, Nunito.

## What each element means (the three baskets + state)

| Scene object | Money meaning |
|---|---|
| Sky + weather | safe-to-spend state: `left_cycle > 0` → soft day blue + sun; `left_cycle ≤ 0` (not storm) → grey-blue + flat clouds; `storm` → deep slate night + stars + dim moon + rain |
| Wooden rail + engraved plate (left end) | basket 1, bills: `rent {rent} € · paid/due · next ~{rent_window} Oct` |
| 5 flowers along the rail | basket 3, leak categories: tulip = Restaurants, sunflower = Entertainment, daisy = Lifestyle, lavender = Travel, bellflower = Taxi. `wilting` = `last30 > norm` (lowered head, desaturated); `ok` = upright muted; `blooming` = muted category colour; `dormant` = seed mound when `norm = last30 = 0` |
| Pond, lower left | basket 2, buffer: water level = `pond_fill / pond_target` (`sqrt`-scaled ellipse so low fills still read); dry bed = cracks when 0 |
| Birch/rowan behind rail, right | investments: sapling when `invest_total = 0`, grown white-trunk birch with rowan berries when `> 0` |
| Taimi, centre | the user: growth stage = progress (below); mood = posture only, never sad |

## Taimi — growth stages and mood

`stage = 1 + (pond_fill ≥ pond_target) + (invest_total > 0) + (left_cycle > 0)`

| Stage | Name | Persona | Look |
|---|---|---|---|
| 1 | Seed | CUST00359 | soil mound, half-buried seed shell, one curling sprout |
| 2 | Sprout | CUST04957 | slim stem, 4 leaves, two tiny dot eyes on the stem |
| 3 | Sapling | CUST00095 | woody lower stem, side twig, 6 leaves |
| 4 | Young tree | CUST03539 | thin trunk, two-tone leaf canopy, eyes on trunk |

Shown in the top bar as "Stage 2 · Sprout" with 4 dots — not a game level.

Mood is posture only: leaves open (sunny), leaves lowered ~14° (cloudy),
leaves folded ~30° + rain (storm). The face is two small dark eyes, no mouth.

## Palette (flat fills, no gradients, no outlines)

- Sky: `#DCEBF0` day / `#C6D4DA` grey / `#35465E` storm
- Spruce layers: `#6E8A78` / `#7E9A86` (storm: `#26374E` / `#2C4059`)
- Lake strip: `#8FB4C6` (storm `#4A6076`)
- Meadow: `#CBD9B5` / `#B9CCA0` (storm `#5E7050` / `#54644A`)
- Rail wood: `#A98F6E` / `#8A7156`; plate dark wood `#8A7156` + cream text
- Birch trunk `#F0EDE4` with `#4A4A42` marks; rowan berries `#C4685A`
- Taimi greens `#4E7A54` / `#6FA06A` / `#A9C69C`; soil `#7A5F43` / `#8F7452`
- Flower tones (muted): terracotta `#C4806B`, ochre `#CEA65F`, off-white `#EDEAE0`, lavender `#9E97C2`, slate-blue `#93B4CC`; wilt `#B0A68C`
- UI accents only: S-Pankki `#007841` (active tab, CTA, slider), `#00AA46`,
  sage pill `#E4EEE4`/`#3E5C44`, user chat tint `#E3F6EA`

Typography: **Figtree** 500/600/700(800), tabular figures for every amount;
Geist Mono for the SQL receipt. Radii 14–16 px, hairline borders, no heavy
shadows.

## The five screens

1. **Garden home** — full-bleed scene; translucent top bar (Taimi, stage
   label + dots, avatar); the one number on the sky (44 px) with a one-line
   state; two solid white cards (Ask Taimi / You decide + a small sage dot
   when a flower wilts); standard white tab bar (Home · Spending · Goals ·
   Profile) with hairline top border.
2. **Flower sheet** — same scene stays; a small white callout points down at
   the flower; a 45 % white sheet: name, "needs some water" pill, big
   `last30` vs `usual`, a two-bar comparison, `= N h of your work`,
   transaction rows (`top_flower_tx`, MCC labels), and a "How I calculated
   this" disclosure with readable SQL.
3. **You decide** — segmented category control + 0–50 % slider (default 20 %,
   default category = the persona's `top_flower`). Two live scene crops —
   "Today" and "In 6 months" — where the future actually changes: the
   selected flower wilting → ok (≥10 %) → blooming (≥25 %); the pond fills by
   `fill + cum6/pond_target` (capped); Taimi grows one stage when
   `saving ≥ pond_target` or `≥ 300 €`; the sky brightens one step at ≥15 %.
   Below: a 6-bar cumulative chart (Oct–Mar, `norm × cut% × m`), the total
   `+N €` and `= N h of your work`, the honesty line, and a green
   "Make this a goal" CTA. At 0 % the future equals today and the total is
   +0 €; savings under 30 € say so plainly.
4. **Ask Taimi** — a full-width 28 % scene band (slice crop) above a chat:
   Taimi answers as white cards labelled "Taimi", user questions as green
   pills; the four brief questions as quick replies; every answer carries a
   "Receipts · N transactions" disclosure (rows + SQL). The greeting branches
   on state (sunny / over-budget / storm).
5. **Widget** — iOS home with a muted Nordic wallpaper (flat spruce + lake +
   meadow), a 2×2 widget (stage glyph + number + state line), a medium
   widget (scene band crop + number + rent line + one flower status on a
   light chip), one row of neutral icons and a dock.

## Derived formulas (all from the frozen data)

- Number: `left_cycle` (≤0 or storm → `0 €`); sub-line per weather kind.
- Stage: `1 + pondFull + invests + positiveCycle` → 4/3/2/1 for
  03539/00095/04957/00359.
- Simulation: monthly save `= norm × cut%`; 6-month `= ×6`; hours `= ÷ hourly`.
- Pond future: `min(1, fill + sav/target)`; stage +1 when
  `sav ≥ pond_target || sav ≥ 300`; sky brightens at `cut ≥ 15`.
- Wilting-flower recovery thresholds: `ok ≥ 5 %`, `blooming ≥ 15 %`.
- Change chips under the future crop name the deltas explicitly (flower
  state transition, `Pond +N €`/`Pond full`, `Stage N → N+1` when it
  advances).
- "Usual" is the persona's own `norm` (median month over last 6, per data
  pipeline); receipts use `top_flower_tx`, falling back to `restaurants_tx`.

## Honesty rules kept

"Approximate" states are labelled; coach text is marked "sample"; the
receipts disclosure shows the exact query; the decide screen states what is
and isn't predictable ("Bills we predict within ~6 % a month. Fun spending is
your call — we show both futures."). Non-shaming copy throughout — a wilting
flower "needs some water", the seed stage is "resting", never failed.

## Run

`make serve` → http://localhost:4175 · `?persona=CUST04957|CUST00359|CUST00095|CUST03539&theme=light|dark`
(light is the default regardless of OS preference). `make check`, `make
design-lint`, `make clean`, `make reset`.
