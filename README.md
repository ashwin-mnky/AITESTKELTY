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

1. Click **"Start Live Match Simulation"**
2. The match plays out automatically (90 minutes compressed into ~3 minutes)
3. As each event "happens" (kickoff, goals, cards, subs, full time), it appears
   in the live feed
4. The system immediately generates 3 draft posts for that event:
   - **Instagram** — emoji-heavy, hashtags
   - **X/Twitter** — short and punchy
   - **Facebook** — community-focused, slightly longer
5. Click **"Approve & Send"** on any post to mark it ready to publish

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

- `match_data.json` contains one realistic Kelty Hearts match (goals, cards,
  subs, final score) used to drive the simulated feed.
- No live sports API is connected yet. Scottish League Two isn't covered by
  most free live-score APIs — the two realistic paths are:
  - **TheSportsDB Premium** (~$9/month) — live scores updated every 2 minutes
  - **Manual live input** — someone at the match enters events as they happen
- Either source can be dropped into `/api/live-feed` in `server.js` in place
  of the simulated clock, without changing the post-generation or approval UI.

## Files

- `dashboard.html` — Live feed + approval UI
- `match_data.json` — Sample match used to drive the simulated feed
- `server.js` — Simulated live clock, post generation (with AI fallback), API routes
- `package.json` — Dependencies
- `README.md` — This file

## Status

Week 5 prototype — proves the automation concept (detect → draft → approve)
end to end using a simulated live feed.
