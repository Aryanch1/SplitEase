# SplitEase — Design Spec

**App:** SplitEase — shared-expense splitter for roommates, trips and group dinners.
**For:** roommates, travel groups, friends splitting dinners — anyone tired of the "you owe me" spreadsheet in their head.
**Theme:** ledger ink navy `#16233A` (deep `#0C1626`, light `#2C4265`, soft `#DFE6F0`, pale `#EFF2F7`) with coin-gold accent `#C98A1B` / `#E9B44C` on warm paper surfaces over a cream/amber aurora gradient. Owed money reads deep green `#1E7A4C`; money owed reads warm terracotta `#C2410C`.
**Display font:** Fraunces 700/900 (bundled via `@expo-google-fonts/fraunces`) for headlines, screen titles and big numbers; system font for body. Fraunces is deliberately different from FridgeToMeal and MediGuide's Sora.
**Figma:** https://www.figma.com/design/4WGmC47UBqTvy6Jwq8KSVM — "SplitEase — Daily App" (Tokens & Components page + screen frames).

## Distinct identity (per the 2026-11-15 distinct-interface rule)

SplitEase is the first app under the rule, and it must NOT look like FridgeToMeal or MediGuide:
- **Layout:** ledger-first — the home screen leads with a big net-balance figure (typographic data hero), not a photo. No photo hero anywhere in the app.
- **Navigation:** top segmented tabs (Ledger | Activity | People) + a sticky bottom "Add expense" CTA bar. NO floating glass pill tab bar, NO deck of cards.
- **Hero treatment:** an ink-navy balance card with huge Fraunces numerals and a coin-stack graphic drawn in views; the welcome screen carries the same drawn ledger graphic (coin stack + balance rows), not a photo.
- **Imagery layer:** a designed graphic system, not photos — coin stacks, avatar initial circles in member colors, a gold jar for refresh, ledger lines. Expenses are not a visual subject, so the graphic system carries the imagery layer.
- **Palette/font:** ink navy + coin gold + warm paper; Fraunces serif display. It must read as a money tool at a glance.

## Design tokens (lib/theme.ts)

- Palette: ink navy primary + coin-gold accent + warm paper neutrals; owed green / owe terracotta as ledger semantics; warning amber; error red.
- Radii: cards 30px, sheets 38px top, pills fully round, inputs 24px.
- Spacing: 8-point grid (4/8/16/24/32/48).
- Shadows: soft card shadow, ink glow on primary CTA, gold glow on the Settle-up CTA.
- Type scale: Display 42 (56 wide) / Title 24 / Subtitle 17 / Body 15 / Caption 12 / Label 11.
- Breakpoints: `<600` phones (single column) · `600–840` large phone / foldable folded · `840–1280` tablet / foldable unfolded (two-pane: ledger left, activity right) · `≥1280` desktop centred shell (max 1120).

## Screen inventory & flow

1. **Splash** — warm paper, gold coin mark, "SplitEase".
2. **Welcome** (gate on every open for signed-out non-guests) — drawn ledger graphic (coin stack + balance rows on ink), headline "Split it fair. Settle it fast.", exactly four options: Continue with Google · Create account (name + email + password + confirm, match check) · Log in (email/password + Forgot password) · Continue without an account.
3. **Home / Ledger** — ink balance card (your net figure in huge Fraunces numerals, group spent / expense count / payments-to-settle stats, gold Settle-up CTA + Add-expense CTA); top segmented tabs Ledger | Activity | People; Ledger tab: people rows with owe/owed pills + fewest-payments settle-up plan with Record buttons; Activity tab: expense timeline grouped by date; People tab: group chips + members + manage link; History "Use again" chips; sticky bottom Add-expense bar. Wide screens: two-pane split (ledger left, activity right).
4. **Add expense** — description, amount, who paid (chips), category chips, date, split mode (equal / custom per-person amounts with a sum check), receipt AI section (scan photo / paste text → items + total → "Use these details" prefills the form). Submit navigates to the new expense detail (visible feedback).
5. **Expense detail** (`/expense/[id]`) — ink amount card, receipt items when scanned (LIVE AI / DEMO badge), per-person share rows with a PAID tag, edit (description + amount, shares recomputed), delete (two-tap confirm), Use again.
6. **Settle up** — fewest-payments plan with Record buttons (confirmation shown in place), net balances per person, manual payment form (from / to / amount), recorded-payments history.
7. **People & groups** — group list with ACTIVE marker + switch, create group (name + emoji + comma-separated people), members with remove (guarded when on past expenses), demo-data note + clear, clear-group-expenses (two-tap).
8. **Settings / Profile** — avatar (client-side resized, stored on the user doc), display name, email + sign-in method, password-reset email, sign out; guest account card routing to Welcome; service status; version read from `app.json`; clear history / clear demo data.
9. **Help** — splitting in four steps, receipt AI, equal vs custom, privacy, about.
10. **Empty/error states** — no group, no expenses, everyone settled, expense not found, receipt unreadable, custom shares not adding up, remove-member guards.

## Transition & animation plan

- App open: splash holds on warm paper until Fraunces loads; balance card fades/slides in (spring).
- Welcome → Home: slide_from_right (expo-router stack default for the app).
- Home → Add / Detail / Settle: slide in; after saving an expense the detail screen opens (new screen = visible feedback); after recording a payment a confirmation pill appears where the user is looking.
- Cards/lists: staggered rise (`FadeInDown` + spring, 50–70ms stagger).
- Buttons: Reanimated spring press to ~0.95 with overshoot settle; glow tightens; light haptic on primary actions (mobile only). Gold Settle-up CTA carries the gold glow.
- Chips: pop (scale bounce 1.18 → 1) when selected.
- Loading: bouncing dots inside the CTA; skeleton-free — the button itself animates, never freezes.
- Custom pull-to-refresh: coins dropping into a jar, scrubbed by pull distance (threshold 90px); on release the coins bounce while data returns, then content settles with a spring. On web the same coins animate on the header refresh button.
- History "Use again": creates the expense and opens its detail screen, with "Added …" shown on the home screen first.

## Visual self-check — quality + distinctness

Scored against the 8 shared rules in `DESIGN_REFERENCE.md` plus DISTINCTNESS (could this screen be mistaken for FridgeToMeal or MediGuide?). Honest estimates, 2026-11-16 (code review against the `expo export` build; live Vercel URL pending):

| Screen | Quality | Distinctness | Notes |
|---|---|---|---|
| Home / Ledger | ~90% | Distinct | Ink balance card + huge Fraunces figure + segmented tabs; no photo, no pill tab bar. Shortfall: the balance card is a flat ink panel — a subtle coin texture would deepen it. |
| Welcome | ~88% | Distinct | Drawn ledger graphic (coin stack + rows) instead of a photo; Fraunces headline. Shortfall: no member avatars on this screen. |
| Add expense | ~88% | Distinct | Ink amount field, category chips, receipt card with LIVE/DEMO badge. Shortfall: receipt photo preview is not shown after picking. |
| Expense detail | ~88% | Distinct | Ink amount card + share rows with PAID tags. Shortfall: share rows are plain — no per-person balance bar. |
| Settle up | ~90% | Distinct | Gold Record CTAs, net-balance list, manual form. Shortfall: no progress indicator toward "all settled". |
| People & groups | ~85% | Distinct | Group chips + member rows; emoji group picker. Shortfall: group cards are compact, not editorial. |
| Settings / Help | ~85% | Distinct | Same token system, ink headers. Shortfall: settings header is plain text, not a display moment. |
