# Design system: Option C "Market"

Colour, surface, type, motion and accessibility rules for turbo-start-paystack. Every value here is final. Where a value comes from the reference grid, it is pinned exactly. Everything else is derived in OKLCH and checked for contrast.

- Visual proof (light and dark side by side): `/private/tmp/claude-501/-Users-foster-Documents/0c429729-c69b-4d24-8224-ef1d844ae497/scratchpad/palette/index.html`
- Screenshots: see [9. Visual proof](#9-visual-proof)
- Contrast checker and generator: `…/scratchpad/palette/pal.py` (with `ok.py`)

---

## 1. Intent and principles

### Who uses it

| Person | When they open it | What they need in one glance |
| --- | --- | --- |
| **Owner / billing manager** (Ada at Kola Logistics, a 6–50 person SME in Lagos, Accra, Joburg or Nairobi) | Monthly, plus whenever Paystack emails about a failed charge | "Am I OK? What will I pay, when, and on which card?" |
| **Admin** | When inviting people | "How many seats are left?" |
| **Member / viewer** | Rarely see billing | Nothing about money; just the workspace |
| **Developer evaluating the starter** (landing) | Once | "Does this really bill in naira, cedis, rand, shillings and dollars?" |

### What each screen must make obvious

| Screen | The one thing | Then |
| --- | --- | --- |
| Dashboard | **Plan state + next charge** (`₦30,000 on 12 Nov`) | Seats headroom, then the team |
| Billing (active) | **Next charge amount, date, card**, on the forest panel | What a plan change costs now (prorated), invoices |
| Billing (past_due) | **The risk and the single fix**: "Payment failed. Update card before 1 Nov." | Everything else is muted. Plan changes are disabled, with the reason shown |
| Billing (trialing) | **Days left + first charge amount + date** | Card on file |
| Billing (non_renewing / canceled) | **When access ends** | One way back ("Resume Pro") |
| Payment callback | **Did it work?** Amount charged, plan now active | Link to receipt |
| Members | **Seats used of limit** | Invite form |
| Landing | **Prices are shown in local money** | The billing parts you get |

### Principles (each one is a test you can apply to a screen)

1. **Money is the headline.** On any billing surface, the largest text is an amount, and it sits on the forest panel. If a heading is bigger than the amount, the hierarchy is wrong.
2. **State before detail.** Status (active, trial, past due) appears before dates and cards. Status is never shown by colour alone: it is always a Lucide icon plus a word.
3. **Sunflower means "you / yours / this one".** It marks the current plan, the selected currency, or the one money-moving CTA. **At most one sunflower element per region.** If two things are yellow, one of them is wrong.
4. **The forest panel is where money lives.** It is the same dark island in light and dark mode. Nothing that isn't about money or plan state goes on it.
5. **Numbers never move sideways.** Amounts are tabular. They swap in place, and their width is reserved before they change.
6. **Risk gets one action.** A risk state shows a single fix and a deadline, never a menu of options.
7. **No gradients, no glow, no glass, no emoji.** Flat fills, as in the reference.

---

## 2. Palette

### 2.1 Research: how money products build on a deep base plus a warm accent

| Product | Base / accent | How the accent is rationed | Lesson for us | Source (verification) |
| --- | --- | --- | --- | --- |
| **Wise** | Forest Green `#163300` + Bright Green `#9FE870` | The bright colour fills the primary CTA and the forest green is the *ink on it*. Two colours do almost everything | A two-colour system where the dark colour carries text works at scale. We invert it: forest is the surface, sunflower is the marker | [brandcolorcode.com](https://www.brandcolorcode.com/color/forest-green) (third-party; matches wise.com) |
| **Monzo** | Hot Coral `#ff4f40` + deep navy `#091723` | Coral is "reserved for tactile product surfaces" (the card), and **navy is the button colour** | The loud brand colour is not the button colour. Sunflower marks things; forest or off-white acts | [Monzo blog](https://monzo.com/blog/weve-had-a-little-makeover), [shadcn.io/design/monzo](https://www.shadcn.io/design/monzo) (third-party hex) |
| **Mercury** | Near-black indigo `#171721`, off-white text, indigo CTA | Dark-first. Background tinted toward the brand hue, never pure black. Arcadia at in-between weights (420/480) | Tint the near-black toward green (`#0e1311`, the reference). Off-white primary buttons on dark | [shadcn.io/design/mercury](https://www.shadcn.io/design/mercury), [blakecrosley.com](https://blakecrosley.com/guides/design/mercury) (third-party, values disagree slightly) |
| **Stripe** | Blurple primary, **green "Succeeded" status badges** | Status colours stay semantic even though they differ from the brand colour. Tabular figures for financial data | Precedent for green status chips next to a non-status primary. Our primary is green too, so success must differ by hue and icon | [fontalternatives.com](https://fontalternatives.com/inspiration/stripe-sohne/), [open-design.ai](https://open-design.ai/tr/plugins/design-system-stripe/) (third-party) |
| **Linear** | Themes generated in LCH from three inputs: base, accent, contrast | Surfaces are derived, not hand-picked | Our neutral ramp *is* the forest hue at low chroma, so every grey agrees with the brand | [sspai.com](https://sspai.com/post/104449), [linear.app](https://linear.app/now/how-we-redesigned-the-linear-ui) |
| **M-Pesa / Safaricom** | Green, chosen to be "recognisable to every Kenyan" | One colour owns the brand | In East and West Africa, green reads as money and trust: a cultural fit, not a cliché, if executed flat | [Standard Media](https://www.standardmedia.co.ke/amp/article/2000014710/standard-digital) (hex not verified) |
| **Flutterwave** | 2022 Verve rebrand: **six** primary colours, no single signature | Festive and multi-colour | Deliberately the opposite of what we do. Two hues plus status colours make us read as a tool, not a campaign | [Creative Boom](https://creativeboom.com/inspiration/verves-new-identity-for-flutterwave-is-a-celebration-of-african-entrepreneurial-spirit), [HapaKenya](https://hapakenya.com/2022/02/21/flutterwave-launches-new-brand-identity-as-it-seeks-to-expand-services-beyond-payments) |
| **Paystack, Moniepoint, Kuda, Chipper Cash, Clerk** | Not verified this session. paystack.com served a bot wall, and searches returned no first-party colour data | n/a | The African fintech field leans navy, blue and purple. Forest plus sunflower stands apart from all of them, including our own payment provider | No citation; treat as unverified |

**Takeaways applied below:** a near-black tinted toward the brand hue (Mercury); a loud accent that is *not* the default button (Monzo); a two-colour core with dark ink on the bright accent (Wise); status colours that stay semantic beside a green brand (Stripe); a neutral ramp derived from the brand hue (Linear).

### 2.2 Hero mode: **dark**, with light as a derivation

- **Why dark is the hero.** The reference the user loves is dark forest on near-black. Design it first, then derive light mode. Screenshots, the landing page and the OG image use dark.
- **Default remains `system`.** Billing admins work in daylight offices. `next-themes` stays on `defaultTheme="system"` with `disableTransitionOnChange` (already set).
- **How the reference maps into light mode.** Light mode flips the **chrome** (page, cards, text) to green-tinted off-whites. **The forest panel and its tiles do not flip.** They stay `#0f3a25` / `#274e3b` with off-white text in both modes: a dark island that marks "money lives here", much as Wise drops forest-green blocks into a light page. The reference grid therefore looks identical in both modes.
- **Implementation:** the panel element carries `class="dark" data-surface="panel"`, so it re-scopes every token to dark values plus its own greens. Components inside it (badges, buttons, focus rings) adapt with no `dark:` overrides. See §8.

### 2.3 Scales

Rules: one hue per ramp (forest 159°, neutral 163°, sunflower 92°). The reference values are pinned exactly, and their hue sits within ±2.5° of the ramp. All values are in sRGB gamut (clamped by `pal.py`).

**Forest (H 159), 11 steps**

| Step | OKLCH | Hex | Role |
| --- | --- | --- | --- |
| 50 | `oklch(0.975 0.014 159)` | `#effaf3` | tint wash (rare) |
| 100 | `oklch(0.945 0.03 159)` | `#ddf3e6` | |
| 200 | `oklch(0.89 0.055 159)` | `#bde6ce` | |
| 300 | `oklch(0.815 0.085 159)` | `#92d4af` | **link (dark)** |
| 400 | `oklch(0.72 0.11 159)` | `#61ba8b` | progress fill (dark) |
| 500 | `oklch(0.625 0.12 159)` | `#379d6d` | chroma peak |
| 600 | `oklch(0.535 0.11 159)` | `#218055` | **focus ring (light)**, progress fill (light) |
| 700 | `oklch(0.455 0.09 159)` | `#1d6644` | **link (light)** |
| 800 | `oklch(0.389 0.056 161.1)` | **`#274e3b`** | **reference tile** = `panel-tile`, primary-hover (light) |
| 900 | `oklch(0.312 0.061 158.4)` | **`#0f3a25`** | **reference panel** = `panel`, primary (light) |
| 950 | `oklch(0.235 0.042 159)` | `#092417` | deepest ink |

**Neutral, green-tinted (H 163, C ≤ 0.014)**

| Step | OKLCH | Hex | Role |
| --- | --- | --- | --- |
| 0 | `oklch(0.995 0.003 163)` | `#fcfefd` | surface-1 (light) |
| 50 | `oklch(0.975 0.006 163)` | `#f3f8f6` | bg (light) |
| 100 | `oklch(0.946 0.009 161.3)` | **`#e8efeb`** | **reference glyph** = text (dark), on-primary (light), primary (dark) |
| 200 | `oklch(0.91 0.011 163)` | `#dbe4df` | |
| 300 | `oklch(0.85 0.012 163)` | `#c7d0cb` | |
| 400 | `oklch(0.72 0.013 163)` | `#9ea7a2` | |
| 500 | `oklch(0.6 0.014 163)` | `#79837e` | |
| 600 | `oklch(0.5 0.014 163)` | `#5c6661` | |
| 700 | `oklch(0.4 0.013 163)` | `#424a46` | |
| 800 | `oklch(0.29 0.012 163)` | `#262d2a` | |
| 900 | `oklch(0.22 0.011 163)` | `#161c19` | |
| 950 | `oklch(0.181 0.009 169.2)` | **`#0e1311`** | **reference page** = bg (dark) |

**Sunflower (H 92)**

| Step | OKLCH | Hex | Role |
| --- | --- | --- | --- |
| 50 | `oklch(0.982 0.024 92)` | `#fff9e7` | |
| 100 | `oklch(0.96 0.054 92)` | `#fff1c9` | |
| 200 | `oklch(0.925 0.1 92)` | `#fee598` | |
| 300 | `oklch(0.88 0.14 92)` | `#f9d460` | accent-hover |
| 400 | `oklch(0.832 0.158 93.8)` | **`#eac531`** | **reference accent tile** = accent, focus ring (dark + panel) |
| 500 | `oklch(0.765 0.152 92)` | `#d5ae18` | |
| 600 | `oklch(0.665 0.135 92)` | `#b19005` | |
| 700 | `oklch(0.555 0.112 92)` | `#8b7005` | |
| 800 | `oklch(0.445 0.088 92)` | `#655207` | |
| 900 | `oklch(0.33 0.064 92)` | `#413404` | |
| 950 | `oklch(0.22 0.043 87.5)` | **`#231901`** | **reference accent glyph** = on-accent |

*The reference's `#eac532` converts to `#eac531` after OKLCH rounding; the difference is invisible.*

### 2.4 Semantic tokens

| Token | Light | Dark | Why |
| --- | --- | --- | --- |
| `bg` | `oklch(0.975 0.006 163)` `#f3f8f6` | `oklch(0.181 0.009 169.2)` `#0e1311` | Dark is the reference page. Light is a green-tinted off-white, so it never reads as default grey |
| `surface-1` (cards) | `oklch(0.995 0.003 163)` `#fcfefd` | `oklch(0.21 0.013 163)` `#131a17` | One step above bg. In dark, raised means lighter |
| `surface-2` (hover, popover in dark, secondary fill) | `oklch(0.958 0.008 163)` `#edf3ef` | `oklch(0.245 0.015 163)` `#1a231e` | Hover and selected wells |
| `surface-3` (pressed, segmented track, selected nav) | `oklch(0.93 0.011 163)` `#e2eae6` | `oklch(0.28 0.017 163)` `#212c26` | Strongest neutral fill |
| `panel` | `#0f3a25` | `#0f3a25` | Same in both modes: the dark island |
| `panel-tile` | `#274e3b` | `#274e3b` | Tiles, meta wells and badge backgrounds inside the panel |
| `panel-muted` (text) | `oklch(0.82 0.04 159)` `#afccbb` | same | Secondary text on the panel (≥ 5.4:1 on tile) |
| `panel-line` | `oklch(0.43 0.05 159)` `#375846` | same | Dividers and hover fill inside the panel |
| `border` | `oklch(0.9 0.012 163)` `#d7e1dc` | `oklch(0.29 0.015 163)` `#252e29` | Solid in both modes. Light uses a near-bg tint so it recedes; dark solid avoids the alpha glow |
| `border-strong` (input edge) | `oklch(0.62 0.014 163)` `#7f8984` | `oklch(0.52 0.016 163)` `#616c66` | ≥ 3:1 against surface-1, so input edges pass WCAG 1.4.11 |
| `text` | `oklch(0.22 0.018 159)` `#131d18` | `oklch(0.946 0.009 161.3)` `#e8efeb` | Forest-tinted ink; the reference glyph colour in dark |
| `text-muted` | `oklch(0.47 0.016 163)` `#535e58` | `oklch(0.74 0.016 163)` `#a2aea8` | ≥ 5.5:1 on every surface |
| `text-subtle` (placeholders, meta, ≥ 13px only) | `oklch(0.56 0.014 163)` `#6d7772` | `oklch(0.64 0.015 163)` `#848f89` | Still ≥ 4.5:1 on surface-1 |
| `primary` | `#0f3a25` (forest-900) | `#e8efeb` (off-white) | Light: the button *is* the panel colour, a signature. Dark: an off-white button, as Mercury does; no mint "neon" |
| `primary-hover` | `#274e3b` | `oklch(0.985 0.004 163)` `#f8fbf9` | Hover moves away from the bg (lighter in both) |
| `on-primary` | `#e8efeb` | `#0f3a25` | 10.9:1 |
| `accent` (sunflower) | `#eac531` | `#eac531` | Fixed in both modes; it is the brand mark |
| `accent-hover` | `#f9d460` | `#f9d460` | Lighter, so ink contrast goes *up* (12.1:1) |
| `on-accent` | `#231901` | `#231901` | The reference glyph brown, 10.4:1 |
| `focus` (ring) | `#218055` forest-600 | `#eac531` sunflower | Light: 4.6:1 on bg. Dark and panel: sunflower at 7.6–11.2:1, which doubles as a brand moment |
| `link` | `#1d6644` forest-700 | `#92d4af` forest-300 | Green text links |
| `success` / `success-bg` | `oklch(0.47 0.11 142)` `#326a2d` / `oklch(0.955 0.04 142)` `#e2f8df` | `oklch(0.8 0.13 142)` `#8cd384` / `oklch(0.27 0.05 142)` `#172c15` | Hue 142 (leaf) is 17° yellower than forest 159, so it doesn't read as "primary". Always paired with a check icon |
| `warning` / `warning-bg` | `oklch(0.5 0.114 62)` `#905203` / `oklch(0.96 0.025 62)` `#ffefe1` | `oklch(0.82 0.12 62)` `#fcb26f` / `oklch(0.28 0.05 62)` `#3a230c` | **Amber at 62°, kept 30° away from sunflower at 92°**, so "past due" never looks like "current plan" |
| `danger` / `danger-bg` | `oklch(0.52 0.17 27)` `#b6322d` / `oklch(0.958 0.02 25)` `#ffecea` | `oklch(0.79 0.12 25)` `#fe9b93` / `oklch(0.28 0.06 25)` `#421c19` | Warm brick red, which sits with sunflower and forest better than a cool red |
| `info` / `info-bg` | `oklch(0.49 0.1 245)` `#266595` / `oklch(0.958 0.02 245)` `#e7f3fe` | `oklch(0.8 0.08 245)` `#92c4ee` / `oklch(0.28 0.04 245)` `#172b3b` | Muted slate-blue, the only cool hue, kept low-chroma |
| `quiet` / `quiet-bg` (neutral status) | `#535e58` / `#e2eae6` | `#a2aea8` / `#212c26` | Refunded, cancelled, ends-on |

### 2.5 Subscription and invoice status mapping

Sourced from `SubscriptionStatus` in `packages/billing/src/entitlements.ts`. Each badge is an icon plus a label. **There are no dots.**

| Status | Token | Lucide icon | Label (examples) | Note |
| --- | --- | --- | --- | --- |
| `active` | success | `circle-check` | Active | |
| `trialing` | info | `hourglass` | Trial · 9 days left | Time-boxed and not a problem, so info, not sunflower |
| `past_due` | warning | `triangle-alert` | Past due | Becomes **danger** once `graceUntil` has passed |
| `non_renewing` | quiet | `calendar-x` | Ends 12 Nov | Still has access, so it is not an alarm |
| `canceled` | quiet | `circle-slash` | Cancelled | British spelling in UI copy; the code keeps `canceled` |
| `expired` | danger | `circle-x` | Expired | Access lost |
| `incomplete` | info | `loader` (static, not spinning) | Incomplete | Checkout not finished |
| invoice `success` | success | `check` | Paid | |
| invoice `failed` | danger | `x` | Failed | The row action becomes `rotate-cw` "Retry" |
| invoice refunded | quiet | `undo-2` | Refunded | Delete "(refunded)" from the description; the badge already says it |
| invoice `pending` | info | `clock` | Pending | |

On the panel, badges use the dark status text colours on `panel-tile` (all ≥ 4.6:1, as checked below).

### 2.6 WCAG 2 contrast table (all pass AA)

Text pairs need 4.5:1. Focus rings and input edges are non-text and need 3:1. Generated by `pal.py`, 66 pairs, **0 failures**. APCA note: `text-muted` on `bg` is about Lc 70 in light and Lc 64 in dark, which is fine for body text. `text-subtle` stays at 13px or above.

| Mode | Pair | Hex | Ratio | Needs | |
| --- | --- | --- | --- | --- | --- |
| light | `text` on `bg` | #131d18 / #f3f8f6 | 16.08 | 4.5 | PASS |
| light | `text-muted` on `bg` | #535e58 / #f3f8f6 | 6.29 | 4.5 | PASS |
| light | `text` on `surface-1` | #131d18 / #fcfefd | 17.04 | 4.5 | PASS |
| light | `text-muted` on `surface-1` | #535e58 / #fcfefd | 6.67 | 4.5 | PASS |
| light | `text` on `surface-2` | #131d18 / #edf3ef | 15.34 | 4.5 | PASS |
| light | `text-muted` on `surface-2` | #535e58 / #edf3ef | 6.00 | 4.5 | PASS |
| light | `text` on `surface-3` | #131d18 / #e2eae6 | 14.09 | 4.5 | PASS |
| light | `text-muted` on `surface-3` | #535e58 / #e2eae6 | 5.51 | 4.5 | PASS |
| light | `text-subtle` on `surface-1` | #6d7772 / #fcfefd | 4.58 | 4.5 | PASS |
| light | `link` on `surface-1` | #1d6644 / #fcfefd | 6.83 | 4.5 | PASS |
| light | `link` on `bg` | #1d6644 / #f3f8f6 | 6.44 | 4.5 | PASS |
| light | `on-primary` on `primary` | #e8efeb / #0f3a25 | 10.88 | 4.5 | PASS |
| light | `on-primary` on `primary-hover` | #e8efeb / #274e3b | 8.03 | 4.5 | PASS |
| light | `on-accent` on `accent` | #231901 / #eac531 | 10.35 | 4.5 | PASS |
| light | `on-accent` on `accent-hover` | #231901 / #f9d460 | 12.07 | 4.5 | PASS |
| light | `success` on `success-bg` | #326a2d / #e2f8df | 5.79 | 4.5 | PASS |
| light | `success` on `surface-1` | #326a2d / #fcfefd | 6.41 | 4.5 | PASS |
| light | `warning` on `warning-bg` | #905203 / #ffefe1 | 5.51 | 4.5 | PASS |
| light | `warning` on `surface-1` | #905203 / #fcfefd | 6.11 | 4.5 | PASS |
| light | `danger` on `danger-bg` | #b6322d / #ffecea | 5.29 | 4.5 | PASS |
| light | `danger` on `surface-1` | #b6322d / #fcfefd | 5.95 | 4.5 | PASS |
| light | `info` on `info-bg` | #266595 / #e7f3fe | 5.52 | 4.5 | PASS |
| light | `info` on `surface-1` | #266595 / #fcfefd | 6.14 | 4.5 | PASS |
| light | `quiet` on `quiet-bg` | #535e58 / #e2eae6 | 5.51 | 4.5 | PASS |
| light | `quiet` on `surface-1` | #535e58 / #fcfefd | 6.67 | 4.5 | PASS |
| light | `focus` on `bg` | #218055 / #f3f8f6 | 4.57 | 3.0 | PASS |
| light | `focus` on `surface-1` | #218055 / #fcfefd | 4.84 | 3.0 | PASS |
| light | `border-strong` on `surface-1` | #7f8984 / #fcfefd | 3.57 | 3.0 | PASS |
| dark | `text` on `bg` | #e8efeb / #0e1311 | 16.05 | 4.5 | PASS |
| dark | `text-muted` on `bg` | #a2aea8 / #0e1311 | 8.18 | 4.5 | PASS |
| dark | `text` on `surface-1` | #e8efeb / #131a17 | 15.13 | 4.5 | PASS |
| dark | `text-muted` on `surface-1` | #a2aea8 / #131a17 | 7.71 | 4.5 | PASS |
| dark | `text` on `surface-2` | #e8efeb / #1a231e | 13.80 | 4.5 | PASS |
| dark | `text-muted` on `surface-2` | #a2aea8 / #1a231e | 7.03 | 4.5 | PASS |
| dark | `text` on `surface-3` | #e8efeb / #212c26 | 12.37 | 4.5 | PASS |
| dark | `text-muted` on `surface-3` | #a2aea8 / #212c26 | 6.30 | 4.5 | PASS |
| dark | `text-subtle` on `surface-1` | #848f89 / #131a17 | 5.28 | 4.5 | PASS |
| dark | `link` on `surface-1` | #92d4af / #131a17 | 10.32 | 4.5 | PASS |
| dark | `link` on `bg` | #92d4af / #0e1311 | 10.95 | 4.5 | PASS |
| dark | `on-primary` on `primary` | #0f3a25 / #e8efeb | 10.88 | 4.5 | PASS |
| dark | `on-primary` on `primary-hover` | #0f3a25 / #f8fbf9 | 12.20 | 4.5 | PASS |
| dark | `on-accent` on `accent` | #231901 / #eac531 | 10.35 | 4.5 | PASS |
| dark | `on-accent` on `accent-hover` | #231901 / #f9d460 | 12.07 | 4.5 | PASS |
| dark | `success` on `success-bg` | #8cd384 / #172c15 | 8.36 | 4.5 | PASS |
| dark | `success` on `surface-1` | #8cd384 / #131a17 | 9.91 | 4.5 | PASS |
| dark | `warning` on `warning-bg` | #fcb26f / #3a230c | 8.23 | 4.5 | PASS |
| dark | `warning` on `surface-1` | #fcb26f / #131a17 | 9.88 | 4.5 | PASS |
| dark | `danger` on `danger-bg` | #fe9b93 / #421c19 | 7.31 | 4.5 | PASS |
| dark | `danger` on `surface-1` | #fe9b93 / #131a17 | 8.69 | 4.5 | PASS |
| dark | `info` on `info-bg` | #92c4ee / #172b3b | 7.86 | 4.5 | PASS |
| dark | `info` on `surface-1` | #92c4ee / #131a17 | 9.56 | 4.5 | PASS |
| dark | `quiet` on `quiet-bg` | #a2aea8 / #212c26 | 6.30 | 4.5 | PASS |
| dark | `quiet` on `surface-1` | #a2aea8 / #131a17 | 7.71 | 4.5 | PASS |
| dark | `focus` on `bg` | #eac531 / #0e1311 | 11.19 | 3.0 | PASS |
| dark | `focus` on `surface-1` | #eac531 / #131a17 | 10.55 | 3.0 | PASS |
| dark | `border-strong` on `surface-1` | #616c66 / #131a17 | 3.24 | 3.0 | PASS |
| panel | `panel-text` on `panel` | #e8efeb / #0f3a25 | 10.88 | 4.5 | PASS |
| panel | `panel-text` on `panel-tile` | #e8efeb / #274e3b | 8.03 | 4.5 | PASS |
| panel | `panel-text` on `panel-line` (hover) | #e8efeb / #375846 | 6.79 | 4.5 | PASS |
| panel | `panel-muted` on `panel` | #afccbb / #0f3a25 | 7.37 | 4.5 | PASS |
| panel | `panel-muted` on `panel-tile` | #afccbb / #274e3b | 5.44 | 4.5 | PASS |
| panel | `on-accent` on `accent` | #231901 / #eac531 | 10.35 | 4.5 | PASS |
| panel | `focus` (sunflower) on `panel` | #eac531 / #0f3a25 | 7.58 | 3.0 | PASS |
| panel | `success` (dark) on `panel-tile` | #8cd384 / #274e3b | 5.25 | 4.5 | PASS |
| panel | `warning` (dark) on `panel-tile` | #fcb26f / #274e3b | 5.24 | 4.5 | PASS |
| panel | `danger` (dark) on `panel-tile` | #fe9b93 / #274e3b | 4.61 | 4.5 | PASS |
| panel | `info` (dark) on `panel-tile` | #92c4ee / #274e3b | 5.07 | 4.5 | PASS |
| panel | `link` (dark) on `panel-tile` | #92d4af / #274e3b | 5.47 | 4.5 | PASS |
| panel | `on-primary` (forest-900 on off-white) | #0f3a25 / #e8efeb | 10.88 | 4.5 | PASS |

Repairs made during checking (L only, per the colour rules): dark `border-strong` went from L 0.45 (2.39:1, fail) to 0.52 (3.24:1); dark `danger` went from L 0.76 (4.16:1 on the panel tile, fail) to 0.79 (4.61:1).

---

## 3. Surfaces

### Elevation model: fills first, hairlines second, shadows only when floating

| Layer | Light | Dark | Depth cue |
| --- | --- | --- | --- |
| Page | `bg` | `bg` | none |
| Card / tile | `surface-1` | `surface-1` | **1px ring** `box-shadow: 0 0 0 1px var(--border)` (ring, not `border`, so the box size doesn't change) |
| Money panel | `panel` | `panel` | Fill only. It is the darkest/most saturated thing on the page, so it needs no edge |
| Inner well (meta, nested) | `surface-2` / `panel-tile` | same | Fill only |
| Floating (popover, menu, dialog, toast) | `surface-1` + ring + `0 8px 24px -8px oklch(0.2 0.03 160 / 0.18)` | `surface-2` + ring only | The only shadow in the system. Floating layers overlap content and must separate from it. Dark mode drops the shadow (invisible there) |

- **One depth cue per surface.** Today's `Tile` stacks `border` + `shadow-[var(--c-shadow)]`. Pick the ring alone.
- **No gradients anywhere.** No `backdrop-blur` on scrims (there's nothing behind them worth seeing). Scrim colour: `oklch(0.12 0.02 160 / 0.55)`.
- **Separation borders stay real borders:** table row dividers and input edges use `border-top: 1px solid var(--border)` / `border-strong`.
- Hairline at 0.5px on 2× screens for row dividers only (`--hairline`, see CSS).

### Radius scale, taken from the reference

| Token | px | Used for | Rule |
| --- | --- | --- | --- |
| `--radius-panel` | **32** | Money panel, reference grid, landing hero block | From the reference |
| `--radius-tile` | **24** | Cards, plan tiles, invoice list, currency tiles | From the reference |
| `--radius-card` | 16 | Inner wells, popovers, menus, toasts, dialogs (desktop) | |
| `--radius-control` | **12** | Buttons, inputs, selects, segmented track | Rounded squares, not pills. Pills are generic; squares repeat the tile motif |
| `--radius-chip` | **8** | Badges, segmented thumb, icon wells | 12 − 4px track padding = 8, derived |
| `full` | 9999 | Avatars only | |

Nesting: `inner = outer − padding` when the padding is under 24px (segmented: 12 − 4 = 8; menu 16, padding 4 → item 12). The panel (padding 24–28) and tiles (padding 24) have padding of 24 or more, so inner radii are chosen independently (16 for meta wells). The reference proves it: panel 32 with tiles 24.

### Spacing and density

- 4px base. Scale: `4 8 12 16 24 32 48 64`.
- **Reference grid:** padding 24, gap 16, tiles square (gap ≈ 13% of tile width, "generous, even").
- Card padding: 24 desktop / 20 mobile. Panel padding: 28 / 20.
- Section gap: 48 desktop / 40 mobile. Page gutter: 32 / 16. Content max-width: 1120px.
- Rows: 56px (tables). Controls: 44px (buttons, inputs) / 36px (compact, desktop toolbars only, with a 44px hit area).
- Use `gap` on parents, never per-child margins.

---

## 4. Typography

### Families

| Role | Family | Why |
| --- | --- | --- |
| Display + **all money** | **Bricolage Grotesque Variable** | It has `₦ ₵` glyphs (U+20A6, U+20B5), a `tnum` feature and an `opsz` axis (12–96). The geometric, slightly quirky grotesque matches the "bold geometric sans" glyphs of the reference |
| UI text | **Figtree Variable** | Warm, open humanist sans for labels and body; has `tnum` |
| Mono (codes, refs) | Geist Mono | Paystack references only |

**Finding (from the font binaries, checked with fontTools):** **Figtree has no `₦` or `₵` glyph.** Any amount set in Figtree today falls back to a system font for the symbol, which is the mismatched naira in the invoice rows. **Rule: money is always `font-money` (Bricolage).** Both families default to *proportional* digits (Bricolage `0`=670 units, `1`=360), so `tabular-nums` is mandatory on every amount.

Considered and rejected: Inter Tight (has ₦₵ and tnum but is the generic default), JetBrains Mono for amounts (no ₦₵ glyph, and mono reads like "developer"). Once C ships, drop the unused families (`inter-tight`, `jetbrains-mono`, Geist Sans) from `layout.tsx`, since each one is a request.

Load Bricolage's `opsz` axis (`@fontsource-variable/bricolage-grotesque/opsz.css`, check it includes `wght`) and set `font-optical-sizing: auto`. Small table amounts then get the sturdier low-opsz cut and the hero gets the tight display cut, with no manual work.

### Scale

| Token | Size / line-height | Family, weight | Use |
| --- | --- | --- | --- |
| `money-xl` | 56/1 (40 mobile) | Bricolage 600, opsz 96, −0.02em | Panel amount |
| `display` | 40/1.1 (32 mobile) | Bricolage 600, −0.02em | Page title |
| `money-lg` | 32/1 | Bricolage 600, tabular | Plan price |
| `title` | 20/1.3 | Bricolage 600 | Section heading |
| `body` | 15/1.5 | Figtree 400 | Default |
| `body-strong` | 15/1.5 | Figtree 600 | Row primary text, button labels |
| `small` | 13/1.45 | Figtree 500 | Meta, dates |
| `label` | 12.5/1.2 | Figtree 600 | Badges, field labels |
| `caps` | 12/1.2, +0.06em, uppercase | Figtree 600 | Rare section labels only |
| `glyph` | clamp(32px, 6vw, 52px) | Bricolage 700, opsz 96 | Currency tiles (KSh at 0.78×) |

Weights loaded: Figtree 400/500/600, Bricolage 500/600/700. Nothing else.

### Money

**Format** (one shared formatter, built on `formatToParts`. Today `glyphMoney` in `primitives.tsx` and `packages/email/src/format.ts` disagree on whether KSh takes a space):

| Currency | Output | Rule |
| --- | --- | --- |
| NGN | `₦30,000.00` | symbol, no space |
| GHS | `GH₵450.00` | `GH₵` in amounts; bare `₵` only in decorative tiles |
| ZAR | `R540.00` | No space, `,` grouping (not `en-ZA`'s `R 540,00`: one grouping style across a multi-currency product) |
| KES | `KSh 3,900.00` | Alphabetic symbol, so U+202F narrow no-break space. `Intl` gives `Ksh`/`KES`; override it. **Decision for Tope: if you prefer no space, change the email tests' `KSh1,300.00` to match** |
| USD | `$29.00` | |

- Negative/refund: `−₦50.00` (U+2212 minus).
- Every amount: `white-space: nowrap; font-variant-numeric: tabular-nums`.

**Symbol-to-amount alignment**

| Context | Symbol | Decimals | Alignment |
| --- | --- | --- | --- |
| Display (≥ 32px: panel, plan price) | `0.56em`, weight 500, `text-muted` / `panel-muted` | Hide `.00`. Non-zero decimals at `0.5em`, muted | Symbol **top-aligned to the cap height**: flex `align-items: flex-start` + `margin-top: 0.1em`. The period unit (`/ month`, Figtree 14 muted) sits on the baseline at the end |
| Inline / table (≤ 20px) | Same size, weight and colour as the digits | Always show 2dp | Baseline, no gap, **right-aligned** column, so decimal points line up |
| Tile glyph | Alone, centred | n/a | Optical centre: KSh at 0.78× size |

Screen readers: wrap display amounts as `<data value="30000" aria-label="30,000 naira per month">`, because "N with two bars" isn't spoken reliably.

---

## 5. Motion

The stack is Base UI (`data-starting-style` / `data-ending-style`, `--transform-origin`) plus CSS transitions. **Do not add Motion for anything below** except the sheet drag (Base UI drawer or vaul gives velocity for free).

### Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Every enter, press, hover |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Things already on screen moving (segmented thumb, row collapse) |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Sheets |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Short, quiet exits |
| `--dur-press` | 120ms | `:active` scale |
| `--dur-fast` | 150ms | Hover, colour, background |
| `--dur-base` | 200ms | Popover, dropdown, select, tooltip, badge swap |
| `--dur-number` | 240ms | Price and currency changes |
| `--dur-modal` | 240ms enter / 170ms exit | Dialog |
| `--dur-sheet` | 320ms enter / 220ms exit | Bottom sheet |

### Per interaction

| Interaction | Spec | Why |
| --- | --- | --- |
| **Dialog** (desktop) | Overlay opacity 0→1 and content `opacity 0, scale 0.96` → 1, both `--dur-modal` `--ease-out`. Exit: opacity → 0, scale → 0.98, 170ms `--ease-exit`. Centred origin. **Transitions, not keyframes** (`data-starting-style`), so a fast open/close retargets | Paired elements share timing. Exits ~30% faster |
| **Sheet** (mobile < 640px, replaces the dialog) | `translateY(100%)` → 0, 320ms `--ease-drawer`. Exit 220ms. Drag-to-dismiss with velocity (spring, bounce 0). Scrim paired | A finger-driven element needs a velocity-preserving spring |
| **Dropdown / select / popover** | `opacity 0, scale 0.97` → 1 from `transform-origin: var(--transform-origin)`, 180ms `--ease-out`. Exit opacity only, 120ms. Arrow-key highlight movement: **no animation** | Origin-aware. Keyboard actions are never animated |
| **Tooltip** | 400ms open delay, 150ms fade. Warm state: siblings open instantly with no animation, cleared 300ms after the last closes | Avoids flicker along toolbars |
| **Toast** (Sonner) | Enter `translateY(16px), opacity 0` → 0, 240ms `--ease-out`. Exit 170ms. Bottom-centre on mobile above the safe area, bottom-right on desktop. Duration = max(4s, words ÷ 4 per second). Pause on hover and on `visibilitychange` | Reading time scales with content |
| **Plan toggle (monthly ↔ annual)** | Thumb slides `translate` 200ms `--ease-in-out`. Each price: the old value exits `translateY(-8px), opacity 0` in 140ms, the new value enters from `+8px` in 240ms `--ease-out`. Old and new are stacked in one grid cell (`grid-area: 1/1`), so the wider string reserves width (**no layout shift**). The period label crossfades. Cards stagger 30ms left→right (total < 300ms) | The eye follows the change across cards. Tabular digits keep columns still |
| **Currency switch** (landing picker) | Same number transition. The symbol swaps with the digits as one unit. The matching tiles in the reference grid take sunflower via `background-color` 150ms. The previous ones return to tile green | Ties the decorative grid to the real control, a signature moment |
| **Status badge change** (past_due → active after payment) | Background and text colour 200ms. Icon swap: old `scale 0.8, opacity 0` out in 120ms, new `scale 0.8→1, opacity 0→1` in 200ms `--ease-out`. Badge width animates with no layout cost by reserving the larger label | Announce via `aria-live="polite"` |
| **Press feedback** | `scale: 0.97` on `:active`, `--dur-press` `--ease-out`. Clickable cards 0.985. **Not** on nav items, segmented options or table rows | High-frequency controls stay instant |
| **Hover** | `background-color` only, 150ms, inside `@media (hover: hover) and (pointer: fine)` | No stuck hover on touch |
| **Skeleton → content** | Skeletons match the final geometry exactly (same radius, height and amount width in `ch`). Content fades in, opacity only, 200ms. Skeleton pulse: opacity 1 → 0.6, 1.4s ease-in-out infinite. **No shimmer gradient** (no gradients) | Zero CLS |
| **Confirming payment** (`/billing/callback`) | Waiting: Lucide `loader-circle` rotating linear 0.8s + "Confirming with Paystack…", shown only after 400ms (no flash for fast verifies). Success: an icon well `scale 0.9 → 1` (spring, bounce 0.15, the one bounce in the system) with the `check` stroke drawn by `stroke-dashoffset` over 300ms, then "₦30,000.00 paid · Pro is active" fades in 200ms later. Failure: no bounce; the danger icon and copy appear at once | A rare, high-stakes moment can earn a little celebration. Failure is never playful |
| **Table rows** | No entrance on load. Inserted row (new invite): opacity 0 → 1 and `translateY(-4px)` → 0, 200ms. Removed row: fade out 150ms, then collapse with a `grid-template-rows: 1fr → 0fr` wrapper, 200ms `--ease-in-out` | One-off layout motion is acceptable. Siblings shouldn't jump |
| **Theme switch** | No transitions (`disableTransitionOnChange`, already on) | Prevents a ragged cascade |

### Reduced motion (`prefers-reduced-motion: reduce`)

- All transforms and keyframes are removed: dialogs, sheets, menus and toasts appear and disappear instantly. The opacity-only fades are removed too.
- Number changes swap instantly. The status still announces through `aria-live`.
- Callback spinner: replaced by a static `loader-circle` plus the text "Confirming…".
- Skeleton pulse stops (static `surface-2`).

### Performance rules

- Animate **only** `transform`/`translate`/`scale`/`opacity`. Colour and background are allowed for 150–200ms state changes. Never `width`/`height`/`top`/`margin` (except the single row-collapse wrapper above).
- **No bare `transition` / `transition-all`.** The current `sheet.tsx` uses `transition … ease-in-out` (it watches every property and has the wrong easing for an enter). Use `transition-[translate,opacity]`.
- `will-change: transform` only on the sheet, and only if a first-frame hitch shows up on Safari.
- Tabular numbers plus reserved width mean no layout shift when prices change. Fonts are preloaded (Bricolage latin + latin-ext `wght`/`opsz` files) so the hero amount doesn't reflow.
- No `backdrop-filter` anywhere (it is costly and has no purpose on flat surfaces).

---

## 6. Touch and accessibility

| Area | Rule |
| --- | --- |
| Hit targets | ≥ 44×44. Buttons and inputs are 44 tall. Icon buttons can be 36 visual with a `::before { inset: -4px }` to reach 44. Invoice row actions are 44 squares. Segmented track 44 (thumb 36). Nav items 44 |
| Focus | `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`. Ring = forest-600 in light, **sunflower** in dark and on the panel (automatic via the island scope). Never `outline: none` without a replacement |
| Colour independence | Every status is icon + word. Errors are border + icon + message |
| Hover | All `:hover` styles live under `(hover: hover) and (pointer: fine)` (Tailwind v4 `hover:` already does this). No action is reachable only by hover; row actions are always visible |
| Touch | `touch-action: manipulation` on controls; `-webkit-tap-highlight-color: transparent` on `html`, with `:active` styles in its place. `user-select: none` on buttons, chips and tiles only |
| Inputs | `text-base md:text-sm` (16px on touch, to stop iOS zoom). Amounts: `inputmode="decimal"`. Email: `type="email" autocapitalize="none"` |
| Viewport | `viewportFit: "cover"`, `interactiveWidget: "resizes-content"` in the `viewport` export. `themeColor`: light `#f3f8f6`, dark `#0e1311`. Use `h-dvh` for the app shell, never `h-screen` |
| Safe areas | Mobile top bar `pt-[env(safe-area-inset-top)]`. Sticky bottom action bar and sheets: `pb-[calc(16px+env(safe-area-inset-bottom,0px))]`. Toasts sit above the bar |
| Mobile-native patterns | Below 640px: **dialogs become bottom sheets** (cancel plan, change plan, invite). Row `…` menus become action sheets. **Past due shows a sticky bottom bar** with "Update card" and the deadline. Swipe only for sheet dismiss; **no swipe-to-delete** on members or invoices (destructive and undiscoverable). Inner scrollers `overscroll-behavior: contain`; root `none` |
| Keyboard | Plan toggle and currency picker are radio groups (arrow keys, one tab stop). `Esc` closes overlays and focus returns to the trigger. Dialogs trap focus; autofocus the first field on fine pointers only. Add a skip link "Skip to content". DOM order matches visual order (the meta row in the panel stays in reading order on mobile) |
| Live regions | Payment callback, badge changes and toasts are `aria-live="polite"`; payment failure is `role="alert"` |
| Destructive | "Cancel plan" is never adjacent to the primary; it sits in a separate row with a confirm sheet that states what is lost and when |

---

## 7. Unslop checklist (current C screens)

From `…/scratchpad/shots/out/c/*.png`. The live app at `:3200` returned HTTP 500 during this pass (the other agent was mid-migration), so this list is from the screenshots and code.

| # | Now | Fix | Why |
| --- | --- | --- | --- |
| 1 | `₦` in invoice amounts renders in a fallback font (Figtree has no ₦/₵) | All money in `font-money` (Bricolage) + `tabular-nums` | Mismatched glyphs are the loudest "unfinished" tell in a money product |
| 2 | A `$`-in-a-box receipt icon on every invoice row (`billing-desktop-*`) | Delete it. Put a real per-row action (download / retry) at the end of the row | The same icon repeated 5× says nothing, and `$` is wrong for a naira org |
| 3 | Badges are pills with a dot (`• Paid`, `• Active`): the default shadcn badge | Rounded-square chip (radius 8), Lucide icon + word, status tokens | Dots are colour-only. Pills don't echo the tile motif |
| 4 | Pills everywhere: nav, buttons, segmented, badges | Radius 12 controls / 8 chips | Rounded squares *are* the reference. Repeat the signature |
| 5 | Dark mode: mint selected nav and mint "Invite teammate" (`dashboard-desktop-dark`) | Selected nav = `surface-3` + `text`. Primary in dark = off-white | Mint on near-black is the dark-and-neon costume |
| 6 | Sunflower is used for "Current plan" (ring + chip), "Save 17%", and a near-identical amber for the past-due banner (`pastdue-desktop-dark`) | One sunflower per region (current plan). "Save 17%" → quiet chip. Warning → amber at 62° | Two yellows that mean opposite things (yours vs. risk) |
| 7 | Billing panel meta shows "Renews 12 Nov" **and** "Next charge in 15 days" **and** "Currency NGN" (also in the subtitle) | One line: **Next charge ₦30,000 on 12 Nov (in 15 days)**; Card; Seats | The same fact three times. The amount of the next charge is missing |
| 8 | Page subtitle "Plan, card and invoices for Kola Logistics. Prices are in NGN." | Delete, or replace with the state ("Pro · renews 12 Nov") | It restates the nav |
| 9 | "Welcome back, Adaeze" dashboard heading | Lead with the state: "Kola Logistics · Pro" and the next charge | A generic greeting that answers nothing |
| 10 | Landing features: three equal cards with a tinted icon circle, title and two lines | A real annotated screenshot of the billing panel, or a compact 2-column list | This is the canonical generated features grid |
| 11 | Free plan: title "Free" *and* price "Free"; a dashed "Cancel your plan to move to Free" pseudo-button | Price `₦0 / month`. The downgrade becomes a muted text link with an explanation | The dashed button looks disabled, and the word is doubled |
| 12 | Avatars in unrelated pastel hues (peach, lilac, sky) and an olive org chip | Avatars: initials on `surface-3`, or tints drawn from forest/sunflower only. Org chip: a mini reference tile (`panel-tile`, off-white initials, radius 8) | Off-palette hues break the two-colour discipline |
| 13 | `Tile` uses `border` **and** `--c-shadow` | Ring only (§3) | Two depth cues is hedging |
| 14 | Floating sidebar card with border + shadow, inset from the page edge | Flush sidebar on `bg`, no container. Selected item = `surface-3` | The floating-sidebar-card is a template default |
| 15 | Dialog/sheet scrims use `backdrop-blur-xs` over flat bg | Solid scrim `oklch(0.12 0.02 160 / 0.55)` | Glass without anything behind it |
| 16 | `sheet.tsx` uses `transition` (all) + `ease-in-out`; `dialog.tsx` uses keyframe `animate-in` at 100ms | §5 specs: transitions on `data-starting-style`, named properties, `--ease-drawer` | Interruptible, correct easing, no accidental tweens |
| 17 | "Card verification (refunded)" + a "Refunded" badge | Description "Card verification", badge "Refunded" | Duplicate |
| 18 | Landing currency grid repeats ₦ R $ ₵ with fixed sunflower positions, unconnected to the picker below | Link the grid to the picker: the selected currency's tiles go sunflower (§5) | Turns decoration into a signature interaction |
| 19 | `c-rise` 420ms entrance on page content | Remove page-load entrances | Resting content shouldn't animate in, and 420ms is over budget |

**The one choice a competitor couldn't copy-paste:** the forest money panel with its sunflower marker, identical in light and dark, plus tiles that light up for your currency.

---

## 8. Ready-to-paste Tailwind v4 CSS

Replaces `apps/web/src/app/theme.css`. It keeps the shadcn token names that `packages/ui` already consumes, so existing components keep working. If the `html[data-direction="c"]` scope still exists, prefix `:root`/`.dark` accordingly.

> **Naming trap:** in shadcn, `--accent` is the *hover surface* used by menu items and ghost buttons. If it were set to sunflower, every menu hover would turn yellow. So the spec's **accent (sunflower) is `--highlight`** in code, and shadcn's `--accent` is `surface-2`.

```css
/* Option C "Market": tokens. Source of truth: docs/design-system.md */

:root {
  /* scales */
  --forest-50: oklch(0.975 0.014 159);
  --forest-100: oklch(0.945 0.03 159);
  --forest-200: oklch(0.89 0.055 159);
  --forest-300: oklch(0.815 0.085 159);
  --forest-400: oklch(0.72 0.11 159);
  --forest-500: oklch(0.625 0.12 159);
  --forest-600: oklch(0.535 0.11 159);
  --forest-700: oklch(0.455 0.09 159);
  --forest-800: oklch(0.389 0.056 161.1); /* #274e3b reference tile */
  --forest-900: oklch(0.312 0.061 158.4); /* #0f3a25 reference panel */
  --forest-950: oklch(0.235 0.042 159);

  --neutral-0: oklch(0.995 0.003 163);
  --neutral-50: oklch(0.975 0.006 163);
  --neutral-100: oklch(0.946 0.009 161.3); /* #e8efeb reference glyph */
  --neutral-200: oklch(0.91 0.011 163);
  --neutral-300: oklch(0.85 0.012 163);
  --neutral-400: oklch(0.72 0.013 163);
  --neutral-500: oklch(0.6 0.014 163);
  --neutral-600: oklch(0.5 0.014 163);
  --neutral-700: oklch(0.4 0.013 163);
  --neutral-800: oklch(0.29 0.012 163);
  --neutral-900: oklch(0.22 0.011 163);
  --neutral-950: oklch(0.181 0.009 169.2); /* #0e1311 reference page */

  --sunflower-50: oklch(0.982 0.024 92);
  --sunflower-100: oklch(0.96 0.054 92);
  --sunflower-200: oklch(0.925 0.1 92);
  --sunflower-300: oklch(0.88 0.14 92);
  --sunflower-400: oklch(0.832 0.158 93.8); /* #eac532 reference accent */
  --sunflower-500: oklch(0.765 0.152 92);
  --sunflower-600: oklch(0.665 0.135 92);
  --sunflower-700: oklch(0.555 0.112 92);
  --sunflower-800: oklch(0.445 0.088 92);
  --sunflower-900: oklch(0.33 0.064 92);
  --sunflower-950: oklch(0.22 0.043 87.5); /* #231901 reference accent glyph */

  /* semantic: light */
  --background: var(--neutral-50);
  --foreground: oklch(0.22 0.018 159);
  --surface-1: var(--neutral-0);
  --surface-2: oklch(0.958 0.008 163);
  --surface-3: oklch(0.93 0.011 163);
  --card: var(--surface-1);
  --card-foreground: var(--foreground);
  --popover: var(--surface-1);
  --popover-foreground: var(--foreground);
  --primary: var(--forest-900);
  --primary-hover: var(--forest-800);
  --primary-foreground: var(--neutral-100);
  --secondary: var(--surface-2);
  --secondary-foreground: var(--foreground);
  --muted: var(--surface-2);
  --muted-foreground: oklch(0.47 0.016 163);
  --subtle-foreground: oklch(0.56 0.014 163);
  --accent: var(--surface-2); /* shadcn hover surface, NOT sunflower */
  --accent-foreground: var(--foreground);
  --highlight: var(--sunflower-400); /* the spec's "accent" */
  --highlight-hover: var(--sunflower-300);
  --highlight-foreground: var(--sunflower-950);
  --link: var(--forest-700);
  --border: oklch(0.9 0.012 163);
  --input: oklch(0.62 0.014 163); /* border-strong: 3.57:1 */
  --ring: var(--forest-600);

  --panel: var(--forest-900);
  --panel-tile: var(--forest-800);
  --panel-line: oklch(0.43 0.05 159);
  --panel-foreground: var(--neutral-100);
  --panel-muted: oklch(0.82 0.04 159);

  --success: oklch(0.47 0.11 142);
  --success-bg: oklch(0.955 0.04 142);
  --warning: oklch(0.5 0.114 62);
  --warning-bg: oklch(0.96 0.025 62);
  --destructive: oklch(0.52 0.17 27);
  --destructive-bg: oklch(0.958 0.02 25);
  --info: oklch(0.49 0.1 245);
  --info-bg: oklch(0.958 0.02 245);
  --quiet: var(--muted-foreground);
  --quiet-bg: var(--surface-3);

  --sidebar: var(--background);
  --sidebar-foreground: var(--foreground);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--surface-3); /* selected nav item */
  --sidebar-accent-foreground: var(--foreground);
  --sidebar-border: var(--border);
  --sidebar-ring: var(--ring);

  --scrim: oklch(0.12 0.02 160 / 0.55);
  --elevation-float: 0 0 0 1px var(--border), 0 8px 24px -8px oklch(0.2 0.03 160 / 0.18);
  --hairline: 1px;

  /* shape */
  --radius: 12px; /* control; shadcn derives sm/md/lg/xl from this */

  /* motion */
  --dur-press: 120ms;
  --dur-fast: 150ms;
  --dur-base: 200ms;
  --dur-number: 240ms;
  --dur-modal: 240ms;
  --dur-modal-exit: 170ms;
  --dur-sheet: 320ms;
  --dur-sheet-exit: 220ms;

  /* type */
  --app-font-display: "Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif;
  --app-font-money: "Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif;
  --app-font-sans: "Figtree Variable", ui-sans-serif, system-ui, sans-serif;
  --app-font-mono: var(--font-geist-mono), ui-monospace, monospace;
}

@media only screen and (min-resolution: 192dpi) {
  :root { --hairline: 0.5px; }
}

/* semantic: dark (hero). Also applied to the money panel via class="dark". */
.dark {
  --background: var(--neutral-950);
  --foreground: var(--neutral-100);
  --surface-1: oklch(0.21 0.013 163);
  --surface-2: oklch(0.245 0.015 163);
  --surface-3: oklch(0.28 0.017 163);
  --card: var(--surface-1);
  --card-foreground: var(--foreground);
  --popover: var(--surface-2);
  --popover-foreground: var(--foreground);
  --primary: var(--neutral-100);
  --primary-hover: oklch(0.985 0.004 163);
  --primary-foreground: var(--forest-900);
  --secondary: var(--surface-2);
  --secondary-foreground: var(--foreground);
  --muted: var(--surface-2);
  --muted-foreground: oklch(0.74 0.016 163);
  --subtle-foreground: oklch(0.64 0.015 163);
  --accent: var(--surface-2);
  --accent-foreground: var(--foreground);
  --link: var(--forest-300);
  --border: oklch(0.29 0.015 163);
  --input: oklch(0.52 0.016 163); /* 3.24:1 */
  --ring: var(--sunflower-400);

  --success: oklch(0.8 0.13 142);
  --success-bg: oklch(0.27 0.05 142);
  --warning: oklch(0.82 0.12 62);
  --warning-bg: oklch(0.28 0.05 62);
  --destructive: oklch(0.79 0.12 25);
  --destructive-bg: oklch(0.28 0.06 25);
  --info: oklch(0.8 0.08 245);
  --info-bg: oklch(0.28 0.04 245);
  --quiet: var(--muted-foreground);
  --quiet-bg: var(--surface-3);

  --sidebar: var(--background);
  --sidebar-foreground: var(--foreground);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--surface-3);
  --sidebar-accent-foreground: var(--foreground);
  --sidebar-border: var(--border);
  --sidebar-ring: var(--ring);

  --elevation-float: 0 0 0 1px var(--border);
}

/* The money panel: <section class="dark" data-surface="panel">.
   Inherits dark tokens, then swaps surfaces for its own greens. Same in both modes. */
[data-surface="panel"] {
  --card: var(--panel-tile);
  --surface-1: var(--panel-tile);
  --surface-2: var(--panel-line);
  --surface-3: var(--panel-line);
  --secondary: var(--panel-tile);
  --muted: var(--panel-tile);
  --accent: var(--panel-line);
  --muted-foreground: var(--panel-muted);
  --border: var(--panel-line);
  --success-bg: var(--panel-tile);
  --warning-bg: var(--panel-tile);
  --destructive-bg: var(--panel-tile);
  --info-bg: var(--panel-tile);
  --quiet-bg: var(--panel-tile);
  background-color: var(--panel);
  color: var(--panel-foreground);
}

@theme inline {
  --font-money: var(--app-font-money);

  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-primary-hover: var(--primary-hover);
  --color-subtle-foreground: var(--subtle-foreground);
  --color-highlight: var(--highlight);
  --color-highlight-hover: var(--highlight-hover);
  --color-highlight-foreground: var(--highlight-foreground);
  --color-link: var(--link);
  --color-panel: var(--panel);
  --color-panel-tile: var(--panel-tile);
  --color-panel-line: var(--panel-line);
  --color-panel-foreground: var(--panel-foreground);
  --color-panel-muted: var(--panel-muted);
  --color-success-bg: var(--success-bg);
  --color-warning-bg: var(--warning-bg);
  --color-destructive-bg: var(--destructive-bg);
  --color-info: var(--info);
  --color-info-bg: var(--info-bg);
  --color-quiet: var(--quiet);
  --color-quiet-bg: var(--quiet-bg);

  --color-forest-50: var(--forest-50);
  --color-forest-100: var(--forest-100);
  --color-forest-200: var(--forest-200);
  --color-forest-300: var(--forest-300);
  --color-forest-400: var(--forest-400);
  --color-forest-500: var(--forest-500);
  --color-forest-600: var(--forest-600);
  --color-forest-700: var(--forest-700);
  --color-forest-800: var(--forest-800);
  --color-forest-900: var(--forest-900);
  --color-forest-950: var(--forest-950);
  --color-sunflower-300: var(--sunflower-300);
  --color-sunflower-400: var(--sunflower-400);
  --color-sunflower-950: var(--sunflower-950);

  --radius-chip: 8px;
  --radius-control: 12px;
  --radius-card: 16px;
  --radius-tile: 24px;
  --radius-panel: 32px;

  --shadow-float: var(--elevation-float);

  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
}

@layer base {
  html { -webkit-tap-highlight-color: transparent; }
  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  button, a, input, select, textarea, [role="button"] { touch-action: manipulation; }
  [data-money] {
    font-family: var(--font-money);
    font-variant-numeric: tabular-nums;
    font-optical-sizing: auto;
    white-space: nowrap;
  }
}

/* Press feedback (not on nav, segmented or rows). */
[data-slot="button"] {
  transition-property: background-color, color, scale;
  transition-duration: var(--dur-fast), var(--dur-fast), var(--dur-press);
  transition-timing-function: var(--ease-out);
}
[data-slot="button"]:active:not(:disabled) { scale: 0.97; }

/* Popups: Base UI exposes --transform-origin and starting/ending styles. */
[data-slot="dropdown-menu-content"],
[data-slot="select-content"],
[data-slot="popover-content"] {
  transform-origin: var(--transform-origin);
  transition: opacity 180ms var(--ease-out), scale 180ms var(--ease-out);
}
[data-slot="dropdown-menu-content"][data-starting-style],
[data-slot="select-content"][data-starting-style],
[data-slot="popover-content"][data-starting-style] { opacity: 0; scale: 0.97; }
[data-slot="dropdown-menu-content"][data-ending-style],
[data-slot="select-content"][data-ending-style],
[data-slot="popover-content"][data-ending-style] { opacity: 0; transition-duration: 120ms; }

@keyframes skeleton-pulse { 50% { opacity: 0.6; } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  [data-slot="button"]:active:not(:disabled) { scale: none; }
}
```

Usage cheatsheet: `bg-panel text-panel-foreground`, `bg-highlight text-highlight-foreground` (sunflower), `rounded-tile`, `rounded-control`, `rounded-chip`, `font-money tabular-nums`, `bg-success-bg text-success`, `ease-out duration-(--dur-base)`, `shadow-float`.

---

## 9. Visual proof

Static page recreating the reference grid, billing card, plan tiles (with a monthly/annual toggle), every status badge, buttons (including the focus ring), invoice rows, the currency set and a toast, in light (left) and dark (right). Rendered with `rpc shot` at desktop-1440 and iPhone 15:

- Page: `/private/tmp/claude-501/-Users-foster-Documents/0c429729-c69b-4d24-8224-ef1d844ae497/scratchpad/palette/index.html`
- Desktop full page: `/private/tmp/claude-501/-Users-foster-Documents/0c429729-c69b-4d24-8224-ef1d844ae497/scratchpad/palette/shots/file-index-desktop-1440.png`
- Desktop slices: `/private/tmp/claude-501/-Users-foster-Documents/0c429729-c69b-4d24-8224-ef1d844ae497/scratchpad/palette/shots/file-index-desktop-1440-slice-01.jpg` … `-slice-04.jpg`
- iPhone 15 full page: `/private/tmp/claude-501/-Users-foster-Documents/0c429729-c69b-4d24-8224-ef1d844ae497/scratchpad/palette/shots/file-index-iphone-15.png`
- iPhone 15 slices: `/private/tmp/claude-501/-Users-foster-Documents/0c429729-c69b-4d24-8224-ef1d844ae497/scratchpad/palette/shots/file-index-iphone-15-slice-01.jpg` … `-slice-09.jpg`

What the proof confirmed, and the fixes made while iterating:
- The reference grid reproduces exactly in both modes (the panel and tiles are constant).
- Top-aligned `0.56em` symbol at 56px reads as one unit with the digits. "/ month" needed `nowrap`.
- Three plan tiles at about 220px width each wrap "/ year": use `auto-fit, minmax(196px, 1fr)` so they stack sooner.
- Invoice dividers must be inset borders on flat rows, not shadows on rounded rows (corners clipped the line).
- On mobile the three panel meta wells waste height, so they collapse into one well with divided rows.
- Dark segmented control: the thumb must be *lighter* than its track (`surface-3` thumb on a `surface-1` track); the first pass had it inverted.
