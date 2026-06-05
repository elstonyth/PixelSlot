# Pokenic Claw-Machine Work — Session Handoff (2026-06-02)

> Paste this (or just say "read docs/CLAW_HANDOFF.md") into a new chat to continue.
> The auto-memory (`phygitals-clone-state.md`) already carries this too.

## Project
`Pokenic_Game` = pixel-perfect clone of **phygitals.com**, rebranded **"phygitals" → "Pokenic"** (frontend only). Next.js 16. **Verify against the PROD server**, not `next dev`:
```
npm run build
npx next start -p 4000   # background
```
Verify with the Playwright scripts in `scripts/*.mjs` (NOT Chrome MCP) → screenshots to `docs/research/packdetail/`, read the PNGs back.

## ⭐ THE KEY DISCOVERY (this session)
The `/claw/[slug]` centerpiece is an **ANIMATED AVIF** (`{slug}-1.avif`, 142 frames / 25fps / ~5.7s loop) — the **claw slides left↔right INSIDE the file**. Earlier work wrongly treated it as static (flattened to a webp + faked a `clawFloat` float = "picture floating around"). **NOW FIXED:** the clone renders a rebranded **animated AVIF in a FIXED `<img>`** (no float) — matches live: machine fixed, claw moves. The banner/wordmark zone is **static across all frames**, so the rebrand is one banner patch pasted onto every frame.

## Rebrand pipeline
Python venv: `C:\Users\PC\iopaint-venv` (IOPaint/LaMa, pillow-avif). Order:
1. `scripts/lama_config.py` — per-machine band/thresh/dilate (dilate=1 ⇒ **stroke-level** masks so the fill blends invisibly; this killed the "blurry/painted patch").
2. `scripts/lama_prep.py` — universal RGB-distance mask → `docs/research/packdetail/lama-{in,mask}/`.
3. `iopaint run --model=lama --device=cpu --image=…/lama-in --mask=…/lama-mask --output=…/lama-out` (only riftbound consumes the LaMa output; flat plates use a harmonic fill).
4. `scripts/lama_compose.mjs` — BROWSER canvas: erases phygitals (harmonic/Laplace stroke-fill, or LaMa for ornate riftbound), draws **lowercase "pokenic"** (Poppins 700 = the phygitals face), **per-machine colour** sampled from the original, **centered on the MEDIAN-x of the wordmark pixels**, flat (glow only on riftbound gold). → `{base}-machine.webp`.
5. `scripts/rebrand_anim.py` — pastes the rebranded banner (top 27%, the static zone) onto **every frame** of the animated source, re-encodes animated AVIF **quality 92** (q80 looked "blurry") → `{base}-anim.avif`. Total ~5.1 MB for 10.

## Wiring
- `src/app/claw/packs-data.ts`: `CLAW_HAS_ANIM` set; `clawMachine()` returns `anim:{base}-anim.avif?v=6`; **`CLAW_REV=6`** (bump on every pixel change so browsers don't show a stale image).
- `src/app/claw/[slug]/PackDetailClient.tsx`: renders `claw.anim ?? claw.webp` in a fixed `<img>`; **`clawFloat` removed**.

## DONE + verified live (headed)
9 reachable pages animate, "pokenic" centered + crisp, per-machine colour, no residue:

| URL | base | status |
|---|---|---|
| /claw/pokemon-mythic | mythic-pack | ✅ animated |
| /claw/pokemon-legend | legend-pack | ✅ |
| /claw/pokemon-elite | elite-pack | ✅ |
| /claw/pokemon-platinum | platinum-pack | ✅ |
| /claw/pokemon-rookie | rookie-pack | ✅ |
| /claw/riftbound-starter | starter-riftbound-pack | ✅ |
| /claw/nba-legend | legend-pack-1dpaec | ✅ |
| /claw/nba-platinum | modern-grails-noafw0 | ✅ |
| /claw/soccer-pro | pro-soccer-pack | ✅ |
| /claw/nba-black | black-pack-jjnfuk | ⚠️ STATIC (only a 1-frame source on disk) |
| (none) | trainer-pack | ✅ built but UNUSED (no pack maps to it) |

Not rebranded (no phygitals on original): One Piece, Baseball, Football, Yu-Gi-Oh (tier-branded).

## ⏳ REMAINING (next session)
1. **Body text** — `"phygitals claw."` placard + `"phygitals.com"` on the machine BASE still say phygitals (static bottom region; rebrand once + paste onto all frames like the banner). User approved → "pokenic claw." / "pokenic.com".
2. **Wordmark realism** — user says "pokenic" looks flat/cheap; make it match the plate's printed/embossed material (it's static, so invest in one good banner).
3. **black-pack-jjnfuk** — find its animated source on live so it animates too.

## Verify commands
- `node scripts/verify-clone-anim.mjs <slug>` — **HEADED** (headless pauses AVIF playback); confirms the claw actually moves.
- `node scripts/crop-guide.mjs <base>=<plateCenterFrac>` — banner crop with a red center guide line (centering check).
- ⚠️ `scripts/detect_centers.py` numbers are UNRELIABLE (the iridescent Pokémon frame fools the text detector) — **verify centering visually**, not by the numbers.

## Gotchas / lessons
- `next start` won't serve NEW public files until a rebuild; always bump `CLAW_REV`.
- Watch runaway node procs (headed browsers leave strays): `@(Get-Process node).Count`; kill playwright strays.
- **Don't declare "done" off your own crops** — verify against the LIVE site's real behavior (animation included). This bit hard repeatedly.
- ~250 files are still **uncommitted** (none of the claw work is committed).
