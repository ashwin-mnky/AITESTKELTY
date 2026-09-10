# Missing Features / Improvement Backlog

Running list of things that could improve the prototype. Nothing here is built yet —
this is a backlog to pick from, not a commitment. Last updated September 2026.

## Actually missing — designed but never built into the app

- **Match Preview posts.** The pre-match hype prompt exists in the Complete Prompt &
  Workflow Library, but the app has no tab or button that generates one. Right now
  the app only covers in-match events (kickoff/goal/card/sub/HT/FT).
- **Post-Match Recap.** Same gap — a full match-report prompt is designed and
  documented, but nothing in the UI generates it.

## Previously suggested, still not built

- **Audience-tailored wording** — same event, worded differently for local fans,
  sponsors, and casual followers (a `goalType`-style field, reusing the existing
  template substitution pattern already used for card types).
- **Sponsor-mention field** — an optional field, like the existing "attach a photo"
  one, to credit a sponsor on relevant posts.
- **A running "sent posts" log** — a record of what's actually been copied/approved
  each matchday, so nothing gets posted twice and there's a record to show later.
- **One-click WhatsApp-style match summary** — combines a match's approved events
  into one paste-ready recap paragraph.
- **Remember last tab/match on reopen** — same localStorage pattern already used for
  saved templates and the tutorial flag.

## New — reflecting what's come up since

- **Speed features for the person actually doing this live.** The person logging
  events pitch-side is typing the full form every time. A "repeat last goal type"
  shortcut, or a couple of one-tap common events, would save them real time instead
  of just looking good in a deck.
- **A visible "time saved" counter in the app itself.** A small running tally
  ("~18 min saved this match") would make the payoff story real during actual use,
  not just on a slide.
- **A safe AI-mode preview.** AI-mode drafting has never been tested end-to-end —
  the available API key has no credit. A one-time cached example response would
  show what AI-written output looks like without needing real API spend.

## Live match data (tracked separately, in progress)

- API-Football's free tier is confirmed to cover Scottish League Two. Next step is
  testing it against a real Kelty Hearts matchday before deciding whether the
  $19/month upgrade is worth it. See chat history / Week 8 roadmap slide for the
  full API comparison research.
