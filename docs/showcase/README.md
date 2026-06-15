# Showcase recordings

Captioned screen recordings of the user roles, with a **visible cursor**,
**click ripples**, and **per-step captions** (none of which Playwright records by
default — they're injected by the harness).

| Video | Flow |
|---|---|
| `guest.{webm,mp4}` | Home → browse packs → pack detail → free **Demo Spin** reveal → sign-up CTA |
| `customer.{webm,mp4}` | Login → top up demo credits → open a pack (charged) → reveal → keep in vault → vault |
| `admin.{webm,mp4}` | Operator login → economy & per-pack RTP → recent pulls ledger → customer support credit-adjust |
| `admin-products.{webm,mp4}` | Product lifecycle: Products catalog → register as a **Gacha Card** (FMV/grade) → create a **Pack** → set the **pool & win-rate odds** |

## How it works

- **Harness:** `scripts/showcase/lib.mjs`
  - `CURSOR_INIT` — injected via `addInitScript` (re-runs on every navigation).
    Draws a fake cursor that follows real mouse events + a ripple on `mousedown`,
    plus a caption banner (`#__cap`). The caption is persisted in `sessionStorage`
    so it survives page navigations.
  - `moveClick` / `moveXY` — move the mouse in interpolated steps so the cursor
    visibly travels before clicking.
  - `startSession` records 1080p `.webm`; `finishSession` finalizes it, renames
    it, and transcodes to `.mp4` (H.264) via **ffmpeg**.
- **Flow scripts:** `scripts/showcase/record-{guest,customer,admin,admin-products}.mjs`
- **`record-admin-products.mjs`** provisions its demo product (with a thumbnail —
  a card requires the product to have an image) via the **admin API**, because the
  multi-step Medusa create-wizard is too brittle to record cleanly. Registering
  the card, creating the pack, and the pool/odds are all real UI. The pool
  membership is set via API (the in-modal card checklist is long/un-searchable).
  The demo product/card/pack are deleted again at the end (cleanup).

## Re-recording

Prereqs: storefront prod build on `:4000`, backend on `:9000`, admin on `:7000`.

```bash
npm run build && npx next start -p 4000        # storefront (prod — crisp visuals)
# backend :9000 + admin :7000 must also be up (see run-preview)

node scripts/showcase/record-guest.mjs
node scripts/showcase/record-customer.mjs
node scripts/showcase/record-admin.mjs
node scripts/showcase/record-admin-products.mjs   # admin :7000 + backend :9000 only
```

Tip: for the admin flows, verify the steps headless first (fast, no video) before
re-recording — see the `verify-flow-before-recording` working note.

Test accounts: customer `stocktest-1@pokenic.local`, admin `qa-admin@pokenic.local`.
Output lands in `docs/showcase/`.
