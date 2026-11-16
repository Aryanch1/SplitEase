# SplitEase

**Split it fair. Settle it fast.** Log who paid for what — SplitEase works out who owes whom and the simplest way to settle up, in the fewest payments.

Built for roommates, trips and group dinners — anyone tired of the "you owe me" spreadsheet in their head.

## What it does

- **Ledger-first home** — your net balance in big numerals (green when the group owes you, terracotta when you owe), per-person owe/owed pills, and the expense timeline.
- **Fewest-payments settle-up** — SplitEase simplifies everyone's debts into the smallest set of payments that clears the group, and records each one as it happens.
- **Equal or custom splits** — split evenly, or type each person's share (the form checks the shares add up to the total).
- **Receipt AI** — snap a receipt photo or paste its text and AI reads the items and total, then fills the expense in for you. When the live service is not connected, pasted receipt text is read on-device instead and the app says so.
- **Groups & people** — one group per trip, household or dinner; switch between them, add or remove people.
- **History** — past expenses are one tap away to log again.
- **Accounts** — sign in with Google or email/password to sync groups and expenses across devices, or continue as a guest (guest mode lasts for this visit only).
- **Demo data included** — a sample Weekend Trip shows the ledger working immediately; clear it from People & groups when you are ready.

## Live

- **Web app:** _live link added once deployed_
- **GitHub:** https://github.com/Aryanch1/SplitEase
- **Design:** https://www.figma.com/design/4WGmC47UBqTvy6Jwq8KSVM — "SplitEase — Daily App"

## Tech

Designed in Figma; React Native + Expo (SDK 58) + TypeScript — one codebase for Android, iOS and web. Gemini AI (`gemini-3.5-flash-lite`) for receipt reading via a Python serverless function (`api/receipt.py`, key held server-side only). Firebase for accounts (Email/Password + Google) and sync. Fraunces display type, ink-navy + coin-gold ledger identity, Reanimated spring motion, custom coins-in-a-jar pull-to-refresh.

## Run it

```bash
npm install
npm run web        # web
npm run android    # Android (Expo Go / dev build)
npm run ios        # iOS (Expo Go)
```

Copy `.env.example` to `.env` to point the receipt reader at a deployed API origin (`EXPO_PUBLIC_API_URL`); without it the web app uses its own `/api/receipt` and native builds fall back to the on-device demo parser. No API key ever belongs in the app or the repo.

## License

MIT License — Copyright (c) 2026 Aryanmouli Cherupalli
