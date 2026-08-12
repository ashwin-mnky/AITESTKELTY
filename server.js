import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
const client = hasApiKey ? new Anthropic() : null;

const matchesFile = JSON.parse(
  fs.readFileSync(path.join(__dirname, "matches.json"), "utf-8")
);
const MATCHES = matchesFile.matches;
let selectedMatchId = MATCHES[0].id;
function currentMatch() {
  return MATCHES.find((m) => m.id === selectedMatchId);
}

const knownTeams = JSON.parse(
  fs.readFileSync(path.join(__dirname, "known_teams.json"), "utf-8")
);
const nextMatch = JSON.parse(
  fs.readFileSync(path.join(__dirname, "next_match.json"), "utf-8")
);

// How fast the simulated match plays out: 1 match-minute = SECONDS_PER_MINUTE real seconds
const SECONDS_PER_MINUTE = 2;

let simulationStartTime = null;

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// List of real matches available to simulate, for the dashboard's dropdown
app.get("/api/matches", (req, res) => {
  res.json(MATCHES.map((m) => ({ id: m.id, label: m.label })));
});

// Switches which real match is loaded, without starting the clock - used
// when the dropdown selection changes, so match-info/team names refresh
// before the user clicks "Start".
app.post("/api/select-match", (req, res) => {
  if (!req.body || !MATCHES.some((m) => m.id === req.body.matchId)) {
    return res.status(400).json({ error: "Unknown matchId" });
  }
  selectedMatchId = req.body.matchId;
  simulationStartTime = null;
  res.json({ selected: selectedMatchId });
});

// Reset/start the simulated live match clock. Optionally pass matchId to
// pick which real match plays out - defaults to whatever was last selected.
app.post("/api/start", (req, res) => {
  if (req.body && req.body.matchId) {
    if (!MATCHES.some((m) => m.id === req.body.matchId)) {
      return res.status(400).json({ error: "Unknown matchId" });
    }
    selectedMatchId = req.body.matchId;
  }
  simulationStartTime = Date.now();
  res.json({ started: true, matchId: selectedMatchId });
});

// Returns events that have "happened" so far in simulated time, plus the
// current simulated match clock so the UI can show a live-updating timer.
//
// Only Kelty Hearts' own events (goals/cards/subs) are surfaced for posting -
// the opponent's team-specific events are skipped entirely, so no post ever
// gets generated for "the other team's" news. Whole-match events (kickoff,
// half-time, full-time) still show, since those are Kelty's own account
// reporting the state of their match, not news about the opponent.
app.get("/api/live-feed", (req, res) => {
  const match = currentMatch();
  const lastMinute = match.events[match.events.length - 1].minute;

  if (!simulationStartTime) {
    return res.json({ events: [], finished: false, currentMinute: 0, score: { home: 0, away: 0 } });
  }

  const elapsedSeconds = (Date.now() - simulationStartTime) / 1000;
  const elapsedMinutes = elapsedSeconds / SECONDS_PER_MINUTE;

  const events = match.events
    .filter((e) => e.minute <= elapsedMinutes)
    .filter((e) => !e.team || e.team === match.homeTeam);

  const finished = elapsedMinutes >= lastMinute;
  const currentMinute = Math.min(lastMinute, Math.floor(elapsedMinutes));
  const score = scoreAtMinute(match, elapsedMinutes);

  res.json({ events, finished, currentMinute, score });
});

// Match metadata so the frontend never has to hardcode team names
app.get("/api/match-info", (req, res) => {
  const match = currentMatch();
  res.json({
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    venue: match.venue,
    competition: match.competition,
  });
});

// Generate Instagram / X / Facebook posts for a single match event.
//
// Normally this uses the currently selected match from matches.json.
// But the caller can instead pass `context: { awayTeam, venue, score }` to
// generate a post for a completely different, made-up match on the fly -
// proving the template/generation logic isn't tied to any one game. Only
// `homeTeam` is fixed to "Kelty Hearts"; everything else is parameterized.
app.post("/api/generate-posts", async (req, res) => {
  try {
    const { event, context, templates } = req.body;

    if (!event) {
      return res.status(400).json({ error: "Event is required" });
    }

    const match = context
      ? {
          homeTeam: "Kelty Hearts",
          awayTeam: context.awayTeam || "Opponent",
          venue: context.venue || "New Central Park",
          score: context.score || { home: 0, away: 0 },
        }
      : {
          homeTeam: currentMatch().homeTeam,
          awayTeam: currentMatch().awayTeam,
          venue: currentMatch().venue,
          score: scoreAtMinute(currentMatch(), event.minute),
        };

    let posts = null;

    if (hasApiKey) {
      const scoreLine = `${match.score.home}-${match.score.away} | ${matchHashtag(match.homeTeam, match.awayTeam)}`;
      const prompt = `PURPOSE: Write draft social media posts announcing a live Kelty Hearts FC match event, in the club's own established voice, for a staff member to review and copy-paste - not to publish automatically.

INFORMATION NEEDED:
- Event that just happened: "${event.text}"
- Current score line: "${scoreLine}"

TONE: Short, punchy, minute-led. Dramatic and celebratory for goals (e.g. "GOOOOOAAALLLLLLL"). Plain and factual for cards, subs, kickoff, half-time, and full-time. Never corporate-sounding.

OUTPUT FORMAT: Return ONLY valid JSON, no other text, in this exact shape:
{
  "instagram": "house-style post, with 1-2 relevant emojis added",
  "x": "house-style post exactly as-is, no extra emojis needed",
  "facebook": "house-style post, with one warm extra sentence inviting fans to follow along"
}

SAMPLE RESULT (real Kelty Hearts posts - match this exact structure: minute, short headline, blank line, brief detail if any, blank line, score + hashtag):
"80' | Substitutions for Kelty Hearts

1-0 | #FORKEL"

"91' | GOOOOOAAALLLLLLL

It's Finlay Moffat who scores a low range effort from the left side of the box!!

3-2 | #KELBRO"

Now write the three posts for the event above, in that exact structure.`;

      try {
        const response = await client.messages.create({
          model: "claude-opus-4-1",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        });

        const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        posts = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      } catch (aiError) {
        console.warn("Claude API unavailable, using free template mode:", aiError.message);
      }
    }

    if (!posts) {
      posts = fallbackPosts(event, match, templates);
    }

    res.json({ posts });
  } catch (error) {
    console.error("Error generating posts:", error);
    res.status(500).json({
      error: "Failed to generate posts",
      details: error.message,
    });
  }
});

// Score at a given point in a match, computed from goal events so far.
//
// Some real matches (e.g. Motherwell B, see matches.json) don't have
// verified goal-by-goal detail - only the confirmed final score. For those,
// no "goal" events are scripted at all, so the sum is always 0-0; once the
// match has reached its last scripted minute (full-time), fall back to the
// match's own finalScore instead of showing an incorrect 0-0.
function scoreAtMinute(match, minute) {
  let home = 0;
  let away = 0;
  for (const e of match.events) {
    if (e.type === "goal" && e.minute <= minute) {
      if (e.team === match.homeTeam) home++;
      else away++;
    }
  }
  if (home === 0 && away === 0 && match.finalScore) {
    const lastMinute = match.events[match.events.length - 1].minute;
    if (minute >= lastMinute) return match.finalScore;
  }
  return { home, away };
}

// Match hashtag in Kelty Hearts' real style, e.g. #FORKEL, #KELBRO
// (home team code + away team code, first 3 letters of each team's first word).
// Takes the two team names explicitly - it doesn't know or care what match
// this is, so it works identically for the loaded match or a made-up one.
function matchHashtag(homeTeam, awayTeam) {
  const code = (name) => name.split(" ")[0].slice(0, 3).toUpperCase();
  return `#${code(homeTeam)}${code(awayTeam)}`;
}

// Fills a template string's {placeholder} tokens from a values object.
// Unknown/missing placeholders become an empty string rather than erroring,
// so a user-written template can't crash the app if they typo a field name.
function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (values[key] ?? "").toString());
}

// The default wording for each event type, written as {placeholder} templates.
// This is also what a user sees pre-filled in the "Customize post wording"
// panel - editing and saving there overrides these per event type.
const DEFAULT_TEMPLATES = {
  kickoff: "{minute}' | Kick-off!\n\n{team} v {opponent} is underway at {venue}.\n\n0-0 | {hashtag}",
  goal: "{minute}' | GOOOOOAAALLLLLLL\n\nIt's {player} who scores with {detail}!!\n\n{score} | {hashtag}",
  card: "{minute}' | {cardType} card for {player} ({team})\n\n{score} | {hashtag}",
  substitution: "{minute}' | Substitution for {team}\n\nOff: {playerOff}\nOn: {playerOn}\n\n{score} | {hashtag}",
  halftime: "HT | {state} at {venue}.\n\n{score} | {hashtag}",
  fulltime: "FT | Full-time {result} for {team} against {opponent}.\n\n{score} | {hashtag}",
};

// Free, no-API-key-required post generator, matching Kelty Hearts' real
// posting house style (minute | headline, blank line, detail, blank line,
// score | match hashtag). Used automatically whenever ANTHROPIC_API_KEY
// isn't set (or the AI call fails), so the tool always works.
//
// `match` is { homeTeam, awayTeam, venue, score } - this function has no
// idea whether it's the loaded simulation or a one-off match someone typed
// in through the "test with a different match" panel. Same code, any match.
//
// `customTemplates` (optional) lets a user override the wording per event
// type from the dashboard's "Customize post wording" panel, using the same
// {placeholder} tokens as DEFAULT_TEMPLATES.
function fallbackPosts(event, match, customTemplates) {
  const { homeTeam, awayTeam, venue, score } = match;
  const hashtag = matchHashtag(homeTeam, awayTeam);

  const values = {
    minute: event.minute,
    team: homeTeam,
    opponent: awayTeam,
    venue,
    hashtag,
    score: `${score.home}-${score.away}`,
    player: event.player || "",
    detail: event.detail || "a well-taken finish",
    cardType: event.cardType || "",
    playerOn: event.playerOn || "",
    playerOff: event.playerOff || "the bench",
    state: score.home > score.away ? `${homeTeam} ahead` : score.home < score.away ? `${homeTeam} behind` : "Level",
    result: score.home > score.away ? "win" : score.home < score.away ? "defeat" : "draw",
  };

  const template =
    (customTemplates && customTemplates[event.type]) ||
    DEFAULT_TEMPLATES[event.type] ||
    "{minute}' | " + (event.text || "") + "\n\n{score} | {hashtag}";

  const body = fillTemplate(template, values);

  return {
    instagram: `${body}\n\n💚🤍`,
    x: body,
    facebook: `${body}\n\nCome along and follow the team! #KeltyHearts`,
  };
}

// So the dashboard's template editor can pre-fill and "reset to defaults"
// without duplicating the wording in two places.
app.get("/api/default-templates", (req, res) => {
  res.json(DEFAULT_TEMPLATES);
});

// Reference list used to warn (not block) on an unrecognized opponent name.
// See known_teams.json for the honesty caveat - it's manually compiled,
// not pulled from a live source, since sports data sites are blocked here.
app.get("/api/known-teams", (req, res) => {
  res.json(knownTeams);
});

// Kelty Hearts' real TheSportsDB team ID - confirmed by fetching a real
// match (lookupevent.php?id=2270202) and reading idHomeTeam from the result.
const KELTY_TEAM_ID = "140311";

// Tries TheSportsDB's free tier for Kelty's real next fixture. Falls back to
// the manually-maintained next_match.json if the request fails for any
// reason (network block, no fixture scheduled, unexpected response shape) -
// same "try live, fall back to something that always works" pattern as the
// AI/template split for post generation.
async function fetchLiveNextMatch() {
  const url = `https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=${KELTY_TEAM_ID}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`TheSportsDB returned ${response.status}`);

  const data = await response.json();
  const event = data.events && data.events[0];
  if (!event) throw new Error("No upcoming fixture returned");

  const isHome = event.strHomeTeam === "Kelty Hearts";
  const opponent = isHome ? event.strAwayTeam : event.strHomeTeam;
  const kickoff = `${event.dateEvent}T${event.strTime}Z`;

  return {
    source: "live",
    opponent,
    venue: `${event.strVenue}${isHome ? " (Home)" : " (Away)"}`,
    competition: event.strLeague,
    kickoff,
  };
}

// Placeholder next-fixture info (see next_match.json for why it's manual,
// not live) - drives the "Next Match" countdown and "Track Live Match" flow.
app.get("/api/next-match", async (req, res) => {
  try {
    const live = await fetchLiveNextMatch();
    res.json(live);
  } catch (error) {
    console.warn("Live fixture fetch failed, using manual next_match.json:", error.message);
    res.json({ ...nextMatch, source: "placeholder" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n⚽ Kelty Hearts Live Match Social Automation running on port ${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser\n`);
});
