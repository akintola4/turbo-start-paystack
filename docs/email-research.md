# Email redesign research

Research for the transactional email redesign (receipts, failed payments,
trial ending, invites, verification). It feeds three directions:

- **Statement**: receipt-grade typography, ledger details, quiet chrome.
- **Forest card**: a dark forest panel (#0f3a25) carrying the amount.
- **Letter**: personal and plain-text-feeling, but typeset with care.

Brand inputs: forest #0f3a25 panels, near-black green #0e1311, off-white
#e8efeb, sunflower #eac532 only for "you/yours", Geist (no ₦ or ₵ glyph).
Customers are in Nigeria, Ghana, Kenya and South Africa, paying through
Paystack.

Researched 29 October 2026.

**How to read the evidence labels.** "Seen" means I looked at the rendered
email (screenshot) or read its source code this session. "Secondary" means
it comes from a gallery description, an article, or general knowledge of the
product's emails that I did not re-check this session. Treat secondary notes
as leads to verify against a real inbox before copying a detail.

## Summary

1. The emails that feel designed are not decorated. They get their character
   from three or four decisions held strictly: one large number, a details
   block with real table structure (label left, value right, hairlines), a
   restrained palette with one accent, and a footer that reads like the small
   print on a paper receipt. Uber, Bilt, Apple and Nike all work this way.
2. A monospace face used for a few "machine" values (transaction ID, amount
   label, footer address) is the single cheapest way to make a receipt feel
   like a ledger. Bilt does this and it is the strongest detail I saw.
3. The amount is the hero. Uber sets "Total" and the figure at roughly twice
   body size in a heavy weight; Apple sets the total at 24px medium against
   12px body. Nothing else on the page competes with it.
4. Geist cannot render ₦ or ₵ (verified in the font files). In clients that
   load Geist, those two characters fall back per glyph to the next font in
   the stack, so the symbol will not match the digits. Plan for it: either set
   the symbol in a deliberate system-font span, or lead with the ISO code
   (NGN, GHS, KES, ZAR) set in Geist.
5. Geist will only load in Apple Mail, iOS Mail, Outlook for Mac and a few
   others. Gmail (the most likely client for this audience) and classic
   Outlook for Windows will show the fallback stack. Design the fallback
   first: the system stack is what most recipients will see.
6. Dark mode is three different problems: Apple Mail honours our CSS; Gmail
   iOS and classic Outlook for Windows fully invert; Outlook.com and the
   Outlook apps partially invert and expose `[data-ogsc]` / `[data-ogsb]`
   hooks. A dark forest panel survives inversion better than a light one, and
   the `linear-gradient` background trick keeps its exact colour in Gmail.
7. Keep the HTML under 102KB (Gmail clips above that, images not counted), use
   PNG not SVG for icons, build buttons as padded table cells (with VML or the
   React Email `Button` mso hack for Outlook), and make every image optional.

## What gives billing emails design feeling

### Seen this session

**Uber, "Your receipt"** (gift card purchase)
<https://reallygoodemails.com/emails/uber-your-receipt>,
screenshot `rge-uber-receipt.png`.

- Chrome: light grey (#eee-ish) top band holding the wordmark "Uber" as type,
  a small grey timestamp ("Nov 28, 2025, 8:32 AM"), then a very large bold
  headline (about 32px, tight tracking) and a one-line subhead.
- Amount: a "Total" heading in large bold sits on the same baseline as the
  figure, right aligned. The total is the biggest thing below the fold.
- Details: three titled groups (line items, "Payments", "Additional
  Information"). Each row is label left in medium weight, value right aligned,
  with full-width hairlines between rows. The discount is the only coloured
  value (green, negative sign). The card row has a small card-brand icon,
  "Capital One ••••6500" and a second grey line with the timestamp.
- Support block: a bordered rounded card with "Need help?", one sentence, and
  a full-width light grey button with an icon.
- Footer: a full-bleed black block with stacked links separated by hairlines,
  social icons, the registered address in grey, and the wordmark again at the
  bottom. The black footer gives the whole email a "bookend".
- Takeaway for us: the bookend (tinted header band, solid dark footer) plus a
  pure ledger middle. Our forest could be that footer band.

**Bilt, "Your rent payment is processing"**
<https://reallygoodemails.com/emails/your-rent-is-processing>,
screenshot `rge-bilt-rent-processing.png`.

- Chrome: wide letterspaced wordmark top left, recipient name and tier
  ("Smiles Davis / Blue") top right in small type. White page, no header band.
- Headline at about 26px regular weight (not bold), then a plain sentence that
  repeats the amount inline.
- Amount: inside a light grey rounded panel, the figure is large and bold
  with a monospace caption under it ("Payment amount", letterspaced). The
  monospace caption is what makes it read as a statement, not marketing.
- Details: inside the same panel, label left (semi-bold) and value right
  (regular): Transaction ID (a long hash), bank account, last four. A final
  row "See payment history for details" with a chevron acts as the link.
- Footer: address, copyright and licence line all set in monospace, small,
  grey, then the wordmark. Very quiet.
- Takeaway for us: monospace for IDs, references and the small print is the
  Statement direction in one move. Use Geist Mono for Paystack references and
  invoice numbers (digits only, not the currency symbol, which Geist Mono also
  lacks).

**Setapp, "Your Setapp membership starts now"**
<https://reallygoodemails.com/emails/your-setapp-membership-starts-now>,
screenshot `rge-setapp-membership.png`.

- Membership details are written as sentences, not a table: grey label then
  dark value inline ("Your plan: Mac plan, monthly." "Upcoming payment date:
  May 8, 2023 (you'll be charged $9.99 unless you cancel by this date)").
- Square-cornered black buttons with white text, no radius, left aligned.
- A dark rounded "Got questions?" panel near the end, and a dark slate footer.
- Takeaway for us: the inline grey-label/dark-value sentence is a good model
  for the Letter direction, where a table would feel too formal.

**Apple receipt (React Email demo template)**
source `apps/demo/emails/Community/receipts/apple-receipt.tsx` in
<https://github.com/resend/react-email/tree/canary/apps/demo/emails/Community>.

- 660px container, 12px body text, grey #666 labels, 10px uppercase-ish
  semibold labels for column heads.
- Metadata block is a light grey (#fafafa) table with 3px radius and white
  1px cell borders: label 10px grey above value 12px. This is the "receipt
  grid" look: small, dense, quiet.
- Line items: 64px rounded (14px) app icon, title 12px semibold, secondary
  lines 12px grey, price right aligned 12px semibold.
- Total: "TOTAL" small grey label with a vertical rule, then the figure at
  24px medium. Light 32px grey "Receipt" heading at the top.
- Footer: all 12px grey centred, links in blue.
- Takeaway: hierarchy from size and grey value, with almost no weight above
  semibold. Very "Statement".

**Nike receipt (React Email demo template)**
source `apps/demo/emails/Community/receipts/nike-receipt.tsx`.

- Headline 32px bold, centred, tracking -1px, leading 1.3.
- Details: 14px, leading 2 (very airy), labels bold, values #747474 medium.
- Hairlines #E5E5E5 between every block; 22px vertical padding per section.
- Footer 13px #AFAFAF centred.
- Takeaway: generous leading in the details block reads expensive.

**Linear login code (React Email demo template)**
source `.../magic-links/linear-login-code.tsx`.

- 560px container, 42px rounded logo, 24px regular heading with -0.5px
  tracking, 15px body at 1.4 leading in #3c4149.
- Button: #5e6ad2, 4px radius, 15px semibold, 11px by 23px padding.
- The code is set in monospace 21px bold on a #dfe1e4 chip with 4px radius.
- Hairline #dfe1e4 then a 14px #b4becc footer link.
- Takeaway: regular-weight headings with negative tracking are the "Linear"
  feel; bold headings would break it.

**Vercel invite (React Email demo template)**
source `.../notifications/vercel-invite-user.tsx`.

- 465px card with a 1px #eaeaea border and small radius, centred on white.
- 24px normal-weight heading centred, 14px body at 24px leading, 12px
  #666666 small print.
- Button: black, 4px radius, 12px semibold, 20px by 12px padding.
- Takeaway: a bordered card on a plain page, monochrome, one black button.

**Raycast magic link (React Email demo template)**
source `.../magic-links/raycast-magic-link.tsx`.

- 28px bold heading, 16px body at 26px leading.
- One accent colour (#FF6363) used only for the link; logo greyscaled.
- A decorative background image pinned to the bottom of the container.
- Takeaway: a single accent used for a single job, which is how sunflower
  should be used for "you/yours".

**Stripe welcome (React Email demo template)**
source `.../welcome/stripe-welcome.tsx`.

- #f6f9fc page, white container with 48px side padding, small 49x21 logo,
  #e6ebf1 hairlines between sections.
- 16px body #525f7f at 24px leading; links #556cd6; footer 12px #8898aa.
- Full-width button #656ee8, 3px radius, 16px bold.
- Signed "The Stripe team". This is the closest reference for "Letter".

### Secondary (not re-checked this session)

**Stripe receipts and invoices** (also what Linear, Vercel, Raycast and many
SaaS products send, since they bill through Stripe). Reference:
<https://docs.stripe.com/receipts>.

- A colour band in the merchant's brand colour, the merchant icon overlapping
  the band, "Receipt from {merchant}", then the amount at about 32px.
- A three-column meta row: Amount paid, Date paid, Payment method (card brand
  glyph and last four). Labels are small uppercase grey.
- "SUMMARY" small caps label, then a light grey rounded box with line items,
  hairlines, and right-aligned amounts; "Amount paid" bold at the bottom.
- Footer: contact line, "Powered by Stripe", receipt number in grey.
- This is the de facto SaaS receipt. Matching it exactly would look generic;
  borrowing the meta row and summary box structure is reasonable.

**Mercury, Wise, Monzo, Cash App, Resend, Loops, Arc**: I could not open
examples of their billing emails this session (galleries do not index them by
brand). From general knowledge: Mercury uses a near-monochrome palette with a
serif display face for headings and small grey details; Wise leads with the
transfer amount in a heavy weight and a bright accent; Monzo and Cash App use
a single bold brand colour block and very large numerals; Resend and Loops
send minimal black-on-white emails built with React Email. Verify before
borrowing any specific detail.

**Paystack's own customer receipts**: not found in public galleries. Paystack
sends a receipt on the merchant's behalf with the merchant's logo, the amount
in naira with the ₦ symbol, a "Paid on" date, payment channel and a
transaction reference. Worth getting a real one from a test transaction, since
our customers will also receive this email and ours should not duplicate it
(see takeaways).

### Gallery entry points

- Receipt / payment category: <https://reallygoodemails.com/categories/receipt-payment>
  (screenshot `rge-receipt-payment-gallery.png`). Other entries worth opening:
  `uber-one-payment-confirmation`, `you-just-got-paid-jan-1st-jan-15th`,
  `your-credit-card-statement-is-available`, `canyon-bicycles-inc-receipt-650500`.
- Confirmation category: <https://reallygoodemails.com/categories/confirmation>
  (screenshot `rge-confirmation-gallery.png`), including `welcome-to-the-pro-plan`
  and `slack-confirmation-code`.
- Dark mode category: <https://reallygoodemails.com/categories/dark-mode>.
- React Email demo templates:
  <https://github.com/resend/react-email/tree/canary/apps/demo/emails>.
  The hosted preview at demo.react.email returned HTTP 500 during research.

## Client constraints

| Constraint | Clients | What we do | Source |
|---|---|---|---|
| Message clipped with "[Message clipped] View entire message" above about 102KB of HTML. Images do not count. Unsubscribe and footer can be cut. | Gmail (all) | Keep each template well under 102KB rendered. Minify, avoid repeated inline style bloat, no base64 images. Check `render()` output size in tests. | [Email on Acid](https://www.emailonacid.com/blog/article/email-development/gmail-clipping/) |
| `border-radius` ignored | Classic Outlook for Windows (2007 to 2019, 365 Word engine) | Accept square corners there. Radius is decoration, never structure. For a rounded button, VML `v:roundrect`. | [caniemail border-radius](https://www.caniemail.com/features/css-border-radius/) |
| `padding` on `<a>` ignored; buttons collapse to the text | Classic Outlook for Windows | Padding on the `<td>` around the link (bulletproof button), or React Email `Button`, which adds mso-only spacer elements. | General practice (bulletproof buttons); React Email `Button` source |
| Line height and paragraph spacing drift; extra space under tables | Classic Outlook for Windows | Use px line-heights with `mso-line-height-rule: exactly`; zero `<p>` margins and set spacing explicitly. | Litmus / general practice |
| `@font-face` web fonts | Work in Apple Mail, iOS Mail, Outlook for Mac, Outlook.com and Outlook apps, Samsung Email (not with Microsoft accounts), Yahoo, Thunderbird. Not Gmail desktop (only Roboto and Google Sans). Classic Outlook for Windows falls back to Times New Roman. | Load Geist where it works; design for the system stack; add an mso-only font override. | [caniemail @font-face](https://www.caniemail.com/features/css-at-font-face/) |
| `prefers-color-scheme` | Honoured: Apple Mail macOS and iOS, Outlook for Mac (partial), some webmails. Not honoured: Gmail apps, Outlook.com, Outlook apps, classic Outlook. | Write a dark-mode block for Apple Mail; design the light version so forced inversion is acceptable. | [Litmus dark mode guide](https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers), [caniemail](https://www.caniemail.com/features/css-at-media-prefers-color-scheme/) |
| SVG images | Gmail rasterises linked SVG (latest caniemail entry, 2026-09) and does not support inline SVG; classic Outlook does not render SVG | PNG at 2x for every icon and logo. | [caniemail image-svg](https://www.caniemail.com/features/image-svg/) |
| Images blocked by default | Classic Outlook for Windows (unknown senders), some corporate gateways | Wordmark as live text or with styled alt text; colour from `bgcolor`, never from an image; no text inside images. | Litmus / general practice |
| `font-variant-numeric: tabular-nums` | No caniemail page exists (the URL 404s), so support is untested | Do not depend on it. Right-align amounts in their own cells; Arial and Segoe UI already use tabular digits by default. | caniemail 404, checked 29 Oct 2026 |
| Width | All; mobile clients scale wide emails | 600px max container, about 520 to 560px content. Fluid below that. | Industry default; React Email templates use 465 to 660px |
| Preheader shows body text if not set | All inbox lists | Set the preview text; React Email `<Preview>` pads it with invisible characters so body text does not leak. | React Email docs |

## Fonts and ₦/₵

### Glyph coverage (checked on macOS with CoreText this session)

| Font | ₦ U+20A6 | ₵ U+20B5 | Notes |
|---|---|---|---|
| Geist (Regular, from `geist@1.8.2`) | No | No | Verified in the font file |
| Geist Mono | No | No | Verified |
| SF Pro (`-apple-system`) | Yes | Yes | Verified |
| SF Mono | Yes | Yes | Verified |
| Helvetica, Helvetica Neue | Yes | Yes | Verified (macOS versions) |
| Arial | Yes | Yes | Verified on macOS; Windows Arial listed by fileformat.info |
| Verdana, Tahoma, Times New Roman, Menlo, Courier | Yes | Yes | Verified |
| Georgia | No | No | Verified. Matters if Letter uses a serif |
| Trebuchet MS, Avenir Next | No | No | Verified |
| Lucida Grande | Yes | No | Verified |
| Segoe UI, Calibri | Yes | Yes | Secondary: [fileformat.info ₦](https://www.fileformat.info/info/unicode/char/20a6/fontsupport.htm), [₵](https://www.fileformat.info/info/unicode/char/20b5/fontsupport.htm) |
| Roboto | Yes | Listed as no | Secondary (fileformat.info lists an older Roboto). Android falls back to Noto Sans, which has both, so ₵ still renders but in a different face |
| Noto Sans | Yes | Yes | Secondary, same source |

Kenya (KSh or KES) and South Africa (R) use Latin letters, so Geist covers them.

### What this means

- When Geist loads (Apple Mail, iOS Mail), the browser takes ₦ and ₵ from
  the next font in the stack. With `-apple-system` next, that is SF, which is
  close to Geist in proportion but not identical; at hero sizes the difference
  in stroke and height is visible.
- When Geist does not load (Gmail, Outlook for Windows), the whole amount is
  set in the fallback font, so the symbol matches. The mismatch problem only
  exists where Geist loads.
- Options, in order of preference for this brand:
  1. **ISO code as a label, figure in Geist.** "NGN" small, letterspaced,
     muted, above or before "250,000.00". Reads as ledger, matches every
     font, and is unambiguous for a multi-country B2B product. Best fit for
     Statement.
  2. **Symbol in its own span set in the system stack**, with weight and
     size tuned so it sits with Geist digits. Good for Forest card, where the
     amount is display size and "₦250,000" is more human than "NGN".
  3. **Symbol inline and accept the fallback.** Acceptable at body size in
     Letter ("We charged ₦250,000 to your card ending 4081"), where the
     mismatch is invisible at 15 to 16px.
- `Intl.NumberFormat` gives "₦" for en-NG NGN, "GH₵" for en-GH GHS, "Ksh" for
  en-KE KES and "R" for en-ZA ZAR (with locale-specific separators). Pick one
  format per currency deliberately rather than relying on the runtime locale.

### What the templates do (decided after this research)

- **Same fix as the app, no ISO-code workaround.** Where web fonts load,
  `@font-face` declares Geist (a 24 KB Latin subset with the `wght` axis,
  served from `apps/web/public/email/fonts`) **and** the app's 1.6 KB Inter
  subset as "Currency Symbols" with `unicode-range: U+20A6, U+20B5` and the
  same `size-adjust` / ascent / descent overrides as
  `apps/web/src/app/layout.tsx`. The browser takes only ₦ and ₵ from it, so
  the symbol sits on Geist's cap height at every size. Checked in Chromium
  (WebKit, which Apple Mail uses, supports `unicode-range` and the overrides;
  not checked in Apple Mail itself).
- **Fallback stack: `'Helvetica Neue', Helvetica, Arial, sans-serif` after
  Geist**, instead of `-apple-system` first. All three have ₦ and ₵ (checked
  above), are neo-grotesques close to Geist, and, unlike SF, draw **tabular
  figures by default**. That keeps right-aligned amounts lined up in Gmail,
  where `font-variant-numeric` support is unknown. Android maps Arial to
  Roboto, whose figures are also tabular.
- **Outlook for Windows:** an `<!--[if mso]>` block pins Arial and Consolas,
  so it never falls to Times New Roman.
- Without `assetsUrl` (no hosted app), no `@font-face` or icon is emitted at
  all and the fallback stack is the design.

### Recommended stacks

- Sans (body and amounts):
  `Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- Mono (references, IDs, small print):
  `"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace`
- Classic Outlook: add an mso-only block so it does not fall to Times New
  Roman:
  `<!--[if mso]><style>body, table, td, p, a, span { font-family: "Segoe UI", Arial, sans-serif !important; }</style><![endif]-->`
  and/or `mso-font-alt: "Segoe UI"` on the `@font-face` rule.
- If Letter uses a serif, do not use Georgia for amounts (no ₦ or ₵). Keep
  amounts in the sans stack, or use a serif stack led by Times New Roman for
  the fallback.

## Dark mode

Per [Litmus](https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers)
(chart dated February 2025):

| Client | Behaviour | Our hook |
|---|---|---|
| Apple Mail macOS, iOS Mail | No forced change; honours `prefers-color-scheme`. Litmus notes pure #ffffff backgrounds can be inverted when the color-scheme meta is present | `@media (prefers-color-scheme: dark)` block with our own palette |
| Gmail web | No colour changes | None needed |
| Gmail iOS | Full inversion | `u + .body` selector, `linear-gradient` background lock, blend-mode trick for white text |
| Gmail Android | Partial inversion | `linear-gradient` background lock |
| Outlook.com, Outlook iOS and Android | Partial inversion; light backgrounds darkened | `[data-ogsc] .x { color }`, `[data-ogsb] .x { background-color }` |
| Classic Outlook for Windows (2021, 365) | Full inversion | Little control; VML areas can be targeted |
| Outlook / Office 365 for Mac | Partial inversion, partial media-query support | Media query plus tolerance |

Techniques:

- Add `<meta name="color-scheme" content="light dark">` and
  `<meta name="supported-color-schemes" content="light dark">`, plus
  `:root { color-scheme: light dark; }`.
- **Background lock for the forest panel**:
  `background-color: #0f3a25; background-image: linear-gradient(#0f3a25, #0f3a25);`
  Gmail changes `background-color` but not gradient images, so the panel keeps
  its exact colour. ([hteumeuleu](https://www.hteumeuleu.com/2021/fixing-gmail-dark-mode-css-blend-modes/))
- **Gmail iOS white text**: Gmail replaces the doctype with `<u></u>`, so
  `u + .body .x` targets Gmail only. Two nested wrappers with
  `mix-blend-mode: screen` and `mix-blend-mode: difference` on #000
  backgrounds restore white text on a coloured panel. Works for white text
  only; does nothing in Gmail with non-Google accounts. Use it for the hero
  amount on the forest panel if Gmail iOS testing shows it turning dark.
- Avoid pure #ffffff on pure #000000; our off-white #e8efeb and near-black
  #0e1311 already avoid both extremes, which reduces how hard clients adjust.
- Sunflower #eac532 on forest: clients that partially invert may shift it.
  Keep any "you/yours" mark as text colour or a small solid swatch, never as
  a large background, so a shifted value does no harm.
- Logos and icons: transparent PNGs with dark ink vanish on inverted
  backgrounds. Either sit them on a solid shape (the forest panel), give them
  a thin light outline or glow, or use a light/dark image pair swapped with
  the media query (Apple Mail) and accept the light one elsewhere.

## Icons and images

- PNG only, exported at 2x and sized with `width`/`height` attributes (for
  example a 96x96 file shown at 48x48). No SVG: Gmail rasterises or drops it
  and classic Outlook does not render it.
- Make the email complete with images off. The forest panel, buttons and
  hairlines are all HTML colour, so the design survives. The logo should be
  live text or carry styled alt text (`style="font-family:...; font-size:
  16px; color: #0e1311"` on the `<img>`), because classic Outlook blocks
  images by default for unknown senders.
- Card brand marks (Visa, Mastercard, Verve) next to "•••• 4081" read as
  receipt detail, as in the Uber email. Small PNGs, with the brand name in
  alt text. Verve matters for Nigeria.
- Do not put text or the amount in an image.

## Takeaways for the three directions

Rules for all three:

1. One hero number per email. Size it at about 2x to 3x the body size and let
   nothing else compete. Everything else is 12 to 16px.
2. Details are a real two-column table: label left in muted colour, value
   right aligned, 1px hairlines between rows, generous row padding (12 to
   16px). Amounts always right aligned in their own cell.
3. Hierarchy from size and grey value, not from bold. Headings regular or
   medium with slight negative tracking (Linear, Bilt); reserve semibold for
   totals and labels.
4. Use Geist Mono for Paystack references, invoice numbers, dates in the
   details block and the footer small print. This is the ledger feeling.
5. Lead amounts with the ISO code in Geist, or set ₦ and ₵ in a deliberate
   system-font span. Never let the symbol fall back by accident at hero size.
6. Sunflower appears once per email at most, for the recipient: their name,
   "your plan", or their card ending. Never on buttons or totals.
7. Build every coloured surface with `bgcolor` plus the `linear-gradient`
   lock, so it survives images-off and Gmail dark mode.
8. One button style: square or 4px radius (radius disappears in Outlook
   anyway), padded table cell, 14 to 15px semibold. One primary action per
   email.
9. Design the fallback type first. Most recipients (Gmail) will see Segoe UI,
   Roboto, Helvetica or Arial, never Geist.
10. 600px max width, about 40px side padding on desktop and 24px on mobile.
11. Footer as quiet small print: company line, why you got this, support
    address, all 12px muted (mono optional). No social icons.
12. Keep each template under about 60KB of HTML so localisation and longer
    invoices never approach the 102KB Gmail clip.
13. Do not duplicate Paystack's own receipt. Ours should carry what Paystack's
    cannot: plan name, billing period, seats, next charge date, the
    organisation, and a link to the billing page.

Direction notes:

- **Statement**: Apple and Bilt are the references. Off-white page, a 12 to
  13px metadata grid (Amount paid, Date, Method) with tiny uppercase labels,
  the total at 28 to 32px Geist medium with "NGN" as a mono label, a full
  ledger table, mono references, mono footer. Chrome is a wordmark and one
  hairline.
- **Forest card**: Uber's bookend structure inverted. A #0f3a25 panel with
  the amount at 40 to 48px in off-white, a muted caption ("Paid 29 Oct ·
  Growth plan"), the details below on the light page. Lock the panel with the
  gradient trick, test Gmail iOS for text inversion, and make sure the panel
  still reads in Apple Mail dark mode (shift the page to #0e1311 so the panel
  remains distinct, or add a 1px lighter border).
- **Letter**: Stripe welcome and Setapp are the references. 16px body at
  about 26px leading, no panels, a greeting, the facts written as sentences
  with grey inline labels ("Plan: Growth, monthly."), one text link or one
  quiet button, signed by a person or "The {Product} team". Amounts inline at
  body size, where the ₦ fallback is invisible. Avoid Georgia for anything
  containing ₦ or ₵.

## Screenshots

Saved in
`/private/tmp/claude-501/-Users-foster-Documents/0c429729-c69b-4d24-8224-ef1d844ae497/scratchpad/email-redesign/research/`
(session scratch, not committed):

- `rge-uber-receipt.png`
- `rge-bilt-rent-processing.png`
- `rge-setapp-membership.png`
- `rge-receipt-payment-gallery.png`
- `rge-confirmation-gallery.png`
- `react-email-src/` (source of the Apple, Nike, Stripe, Linear, Raycast and
  Vercel demo templates)

A cookie banner covers part of the top of each Really Good Emails screenshot.

## Sources

- Really Good Emails, Uber receipt: <https://reallygoodemails.com/emails/uber-your-receipt>
- Really Good Emails, Bilt rent processing: <https://reallygoodemails.com/emails/your-rent-is-processing>
- Really Good Emails, Setapp membership: <https://reallygoodemails.com/emails/your-setapp-membership-starts-now>
- Really Good Emails, receipt / payment category: <https://reallygoodemails.com/categories/receipt-payment>
- Really Good Emails, confirmation category: <https://reallygoodemails.com/categories/confirmation>
- React Email demo templates: <https://github.com/resend/react-email/tree/canary/apps/demo/emails>
- Stripe receipts documentation: <https://docs.stripe.com/receipts>
- caniemail, @font-face: <https://www.caniemail.com/features/css-at-font-face/>
- caniemail, prefers-color-scheme: <https://www.caniemail.com/features/css-at-media-prefers-color-scheme/>
- caniemail, border-radius: <https://www.caniemail.com/features/css-border-radius/>
- caniemail, SVG images: <https://www.caniemail.com/features/image-svg/>
- Litmus, dark mode guide: <https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers>
- Rémi Parmentier (hteumeuleu), Gmail dark mode blend modes: <https://www.hteumeuleu.com/2021/fixing-gmail-dark-mode-css-blend-modes/>
- Email on Acid, Gmail clipping: <https://www.emailonacid.com/blog/article/email-development/gmail-clipping/>
- fileformat.info, fonts with U+20A6: <https://www.fileformat.info/info/unicode/char/20a6/fontsupport.htm>
- fileformat.info, fonts with U+20B5: <https://www.fileformat.info/info/unicode/char/20b5/fontsupport.htm>
- Rezora, web font support by client: <https://support.rezora.com/articles/360010458293-web-fonts-email-client-support>
- Local glyph check: CoreText script run against macOS system fonts and the
  Geist 1.8.2 font files in `node_modules`.
