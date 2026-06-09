# Live phygitals.com — Tech Stack vs Our Clone

Sources: Wappalyzer (user-provided, 2026-06) + the live console/network stack observed
firsthand during QA (PostHog, TalkJS, Cloudflare Turnstile, Vercel `dpl_…`, Privy/Ethers
web3, TikTok pixel) — the two corroborate.

## Stack → our clone's equivalent

| Concern | phygitals.com (live) | Our clone | Match |
|---|---|---|---|
| Framework | Next.js 15.5.18 (App Router) | Next.js 16.2.1 | ✓ (newer) |
| UI runtime | React | React 19 | ✓ |
| UI primitives | **Radix UI** + shadcn/ui | **@base-ui/react** + shadcn-style | ≈ equivalent layer |
| Styling | Tailwind CSS + **styled-components 6.1** | Tailwind v4 (pure, no CSS-in-JS) | ≈ same output |
| Icons | Lucide | lucide-react | ✓ |
| **Animation** | **GSAP + Framer Motion** | **CSS keyframes + tw-animate-css + custom `<Reveal>`** | ✗ **gap** |
| Commerce / cart | **Shopify** | Medusa / Mercur (custom) | ✗ intentional |
| Database | **Supabase** (PostgreSQL) | PostgreSQL via Medusa | ≈ |
| Auth / web3 | Privy + Ethers + WalletConnect | out of scope | ✗ intentional |
| Live chat | TalkJS | out of scope | ✗ |
| Analytics | GA4 · PostHog · FB Pixel · TikTok Pixel | out of scope | ✗ |
| Hosting | Vercel + AWS | Vercel | ✓ |
| CDN / security | Cloudflare (Turnstile, Rocket Loader) | n/a (local/Vercel) | n/a |
| Misc | PWA · Open Graph · HTTP/3 | OG via Next metadata; PWA TBD | partial |

## The one that matters for fidelity: the animation engine

The live site drives motion with **GSAP + Framer Motion**; our clone has **no animation
library** — CSS keyframes (`globals.css`), `tw-animate-css`, and a hand-rolled
IntersectionObserver `<Reveal>`. That is the root cause of "the motion isn't the same":
spring/physics-based, timeline-sequenced motion vs CSS-keyframe approximations. It affects
the **pack-opening reveal**, the **pack cylinder drag**, **carousels**, **scroll-entry**,
and **hover** micro-interactions.

**Recommendation:** for motion-heavy surfaces (pack-opening reveal + cylinder, `/claw`
carousels, hero, scroll-reveal), build with **Framer Motion** — React-idiomatic, with
gesture + layout animations and spring easing that match the live feel far better than CSS
keyframes. Keep plain CSS/Tailwind for simple transitions. (GSAP is the live's other engine,
timeline-based; Framer Motion covers the React use-cases idiomatically — adopt one, not both.)

## Backend / commerce — intentional divergence (no action needed)

Live uses **Shopify** (cart) + **Supabase** + a custom `api.phygitals.com`. Our clone is a
**visual** clone with our own **Medusa/Mercur** backend, so Shopify isn't needed. Web3
(Privy/Ethers), TalkJS chat, and the analytics pixels are out of scope. Mirror these only if
the goal changes from "visual clone" to "functional parity."

## For the re-clone (`/clone-website`)

- Pair the skill's `film-motion.mjs` (frame-by-frame motion capture) with "live = GSAP/Framer
  Motion" → **rebuild animation-heavy components with Framer Motion** for matching easing.
- Primitives: our `@base-ui` is fine; switch to **Radix** only if strict primitive parity matters.
- Styling: pure Tailwind already reproduces the visual output; no need to add styled-components.
- Skip Shopify / Supabase / web3 / chat / pixels (out of scope for a visual clone).
