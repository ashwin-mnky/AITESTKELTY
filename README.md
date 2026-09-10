# Kelty Hearts FC — Live Match Social Media Automation (Prototype)

A working sample that simulates a live match feed and automatically generates
social media posts (Instagram, X, Facebook) for every goal, card, and
substitution — with a human "Approve" step before anything goes out.

## What This Demonstrates

Since a truly live, free data feed for Scottish League Two isn't available
(see notes below), this prototype **replays a real-shaped Kelty Hearts match**
event-by-event on a simulated clock, exactly like a live feed would arrive.
This proves the automation pipeline end to end:

```
Match event happens → detected automatically → AI drafts 3 social posts → human clicks Approve
```

Swap the simulated feed for a paid live-data API later and the rest of the
pipeline (post generation, approval dashboard) doesn't need to change.

## How It Works

1. Pick one of Kelty Hearts' 3 most recent real matches from the dropdown,
   then click **"Start Live Match Simulation"**
2. The match plays out automatically (90 minutes compressed into ~3 minutes)
3. As each event "happens" (kickoff, goals, cards, subs, full time), it appears
   in the live feed
4. The system immediately generates 3 draft posts for that event:
   - **Instagram** — emoji-heavy, hashtags
   - **X/Twitter** — short and punchy
   - **Facebook** — community-focused, slightly longer
5. Click **"📋 Copy"** on whichever platform's version you want, then paste it
   into that app yourself. Click **"✓ Mark as Approved"** to note it's ready.

Also included:
- **Live Match Tracker** — for using this during a real match: no script or
  timer, you log each event as it happens and the score tracks automatically
- **Next Match card** — countdown to kickoff, tries a live fixture fetch first
- **5-scenario dropdown** — proves the generator handles different opponents/
  event types without any code changes, no free-text typing required
- **Customizable post wording** — edit the template per event type using
  `{player}`/`{minute}`/etc. placeholders
- **Desktop notifications** — real OS-level alert when a new post is ready,
  even if you're on another tab or app

## Why This Doesn't Post Automatically

This app **never posts to real Instagram/X/Facebook accounts** — every post
is copy-paste only, by design, for three reasons:

1. **Cost and access are real barriers.** X's posting API now requires a paid
   developer tier (~$100+/month for write access). Meta's (Facebook/
   Instagram) API is free but requires business verification and an app
   review process before it'll publish anything.
2. **"AI" doesn't do the posting anyway.** The AI/template step only writes
   the text. Actually publishing is a separate, ordinary API call to each
   platform - unrelated to Claude or any AI credits.
3. **The risk doesn't fit a prototype.** Automatic posting means a bad or
   wrong draft could go out publicly, on the club's real account, before a
   human ever sees it. A human copy-pasting is a deliberate safety step, not
   a missing feature.

## Setup & Running

### Prerequisites
- Node.js (v16+)
- No API key required — see below.

### Steps

```bash
npm install
npm start
# Open http://localhost:3000
```

### Free mode vs. AI mode
By default (no `ANTHROPIC_API_KEY` set, or no credits on the key), the server
automatically writes posts using built-in templates — no API calls, no cost,
nothing to configure. This is the default and fully working mode.

If you later want AI-written copy instead of templates, set
`ANTHROPIC_API_KEY` (with credits) before running `npm start`:

```bash
export ANTHROPIC_API_KEY='sk-ant-...'
npm start
```

The app checks for a usable key automatically and only calls the AI when one
is available — otherwise it uses the free template mode automatically.

## Live Data: What's Real vs. Simulated Right Now

- **The Practice Simulation tab now auto-refreshes from a live API when a key
  is available.** Set an `API_FOOTBALL_KEY` env var (free tier at
  dashboard.api-football.com, confirmed to cover Scottish League Two) before
  running `npm start`, and the server fetches Kelty's 3 most recently
  finished matches automatically - on startup, and again every 30 minutes,
  so a newly-finished match gets picked up without anyone editing a file.
  The Simulation tab shows a small `🟢 live from API-Football` /
  `⚠ placeholder (manually updated)` badge so it's always honest about which
  mode is actually running.
- **Without a key** (the default), `matches.json` is used instead - manually
  researched and kept current by hand. As of 9 September 2026 that's
  Stranraer (29 Aug, 2-0 loss), Annan Athletic (5 Sept, 2-1 win), and
  Cumbernauld Colts (8 Sept, KDM Evolution Trophy, 3-0 win). Goal scorers and
  final scores are corroborated across 2+ sources each; exact goal minutes
  are not independently confirmed for any of these three, so placeholder
  minutes were chosen within the reported window rather than presenting
  invented precision as fact - see `matches.json`'s own `sourceNote` per
  match for specifics.
- `next_match.json` is Kelty's real next fixture (currently Clyde,
  12 September, away), same manual-fallback pattern as the match history -
  `/api/next-match` already tries TheSportsDB live first, same idea.
- **Caveat on the live path**: this sandbox's network proxy blocks
  api-sports.io the same way it blocks every other sports-data site used in
  this project, so the API-Football integration in `server.js` has been
  written carefully against their documented API shape and defensively
  error-handled, but has not been exercised end-to-end from here. Test it
  for real once a key is set - if anything about the response shape doesn't
  match, it'll just log a warning and fall back to `matches.json`, never
  crash.

## Files

- `dashboard.html` — Tabbed UI: Live Tracker, Practice Simulation, Scenario
  Tester, Settings
- `matches.json` — Kelty's 3 most recent real matches, selectable in the
  Practice Simulation tab
- `next_match.json` — Kelty's real next fixture, for the countdown card
- `known_teams.json` — Reference list used for opponent-name validation
- `server.js` — Simulated live clock, post generation (with AI fallback), API routes
- `package.json` — Dependencies
- `README.md` — This file

## Status

Week 5 prototype — proves the automation concept (detect → draft → approve)
end to end using a simulated live feed.
