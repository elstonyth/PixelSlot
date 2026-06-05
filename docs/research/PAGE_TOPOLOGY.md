# Phygitals Homepage — Page Topology

Target: https://www.phygitals.com/ (desktop 1440 reference; site responsive Tailwind dark mode)

## Architecture
- **Scroll container:** content lives inside `<main class="flex-1 overflow-y-auto bg-white dark:bg-neutral-900">` — page scrolls inside `main`, NOT `<body>`. Total scrollHeight ≈ 4467px.
- **Framework signals:** Tailwind CSS utility classes, **dark mode active** (neutral palette). Maps cleanly onto our shadcn + Tailwind v4 scaffold.
- **Page wrapper:** `main > div.relative.flex.flex-col.dark:bg-neutral-900 > div.mx-auto.w-full.p-4.sm:px-6` (content, h≈4061) + `<footer>` (h≈359).
- **No smooth-scroll library** (no Lenis/Locomotive; `scroll-behavior: auto`). Native scrolling.

## Color tokens (from computed styles)
- Page/body bg: `rgb(26,26,26)` (#1a1a1a) ; dark surface `dark:bg-neutral-900` = `rgb(23,23,23)` (#171717)
- Text: `rgb(250,250,250)` (#fafafa) (neutral-50)
- Header bg: `rgb(23,23,23)` (neutral-900) ; bottom border `1px solid rgb(38,38,38)` (neutral-800)
- Card surfaces: dark neutral (~neutral-900/950 with neutral-800 borders)

## Fonts
- **Display/headings:** `Nekst` (self-hosted) — `https://www.phygitals.com/font/Nekst-Black.woff2`. Used for big headings ("Rip packs. Pull graded cards.", section titles "Recent Pulls", etc.). Heavy/Black weight.
- **Body/UI:** system sans stack (`ui-sans-serif, system-ui, sans-serif`).

## Favicons / meta
- `/favicon.ico`, `/apple-touch-icon.png` (180), `/icon-192x192.png`, `/icon-512x512.png`, `/manifest.json`

## Header / Nav (sticky, static — does NOT transform on scroll)
- Left: phygitals logo (wordmark + mark)
- Center nav: **Packs** (NEW badge), **Pack Party**, **Marketplace**, **Leaderboard**, **More ▾**
- Right: **How it works**, **Login**, **Sign Up** (filled white pill)
- Mobile: hamburger ("Open menu")

## Sections (top → bottom), inside the content container
| # | Name | Height | Imgs | Description |
|---|------|--------|------|-------------|
| 0 | **Hero** | 480 | 20 | Eyebrow "PACKS AVAILABLE NOW"; headline "Rip packs. **Pull graded cards.**" (2nd half muted); subtext "Choose to hold, trade, redeem, or sell it back to us at up to **90% value.**" (pill highlight); "Open Packs" pill button; right side = card-pack hero image over a blurred multicolor gradient blob. |
| 1 | **Open Packs** | 530 | 12 | Heading "Open Packs" + right link "85-90% instant buyback →". Row of 6 category cards: Pokémon, Basketball, Football, One Piece, Baseball, Yu-Gi-Oh!, each = pack image + label + "View Packs" button. |
| 2 | **Recent Pulls** | 492 | 36 | Eyebrow "LIVE FROM THE CLAW"; centered title "Recent Pulls"; subtitle "See what collectors are pulling right now." Horizontal row of pulled graded-card cards: each has "Xm ago" badge, card image on pedestal, card title, pack-type chip ("Rookie Pack"/"Elite Pack") + "Just revealed". |
| 3 | **How It Works** | 520 | 7 | Centered title "How It Works"; step cards/illustrations. |
| 4 | **Our Community** | 492 | 32 | "Our Community" — grid/row of community imagery (avatars/cards). |
| 5 | **Weekly Leaderboard** | 752 | 20 | "Weekly Leaderboard" — ranked list/table of top users with values; tallest section. |
| 6 | **Ready to start collecting?** | 445 | 7 | CTA section — heading + buttons + imagery. |
| 7 | **Footer** | 359 | — | "Quick Links" + columns; `border-t border-neutral-800`, gradient top. |

## Interaction model summary
- Header: static sticky (no scroll transform).
- Card rows (Open Packs, Recent Pulls, Our Community): likely horizontally scrollable carousels; hover states on cards/buttons.
- Buttons: pill-shaped, hover state changes (to extract per-section).
- No global smooth-scroll lib to replicate.
