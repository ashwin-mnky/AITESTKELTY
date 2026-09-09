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
// `MATCHES` is reassigned (not const) because a successful live refresh
// replaces it wholesale - see refreshMatches() below.
let MATCHES = matchesFile.matches;
let matchesSource = "placeholder";
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

// List of real matches available to simulate, for the dashboard's dropdown.
// `source` tells the UI whether this list came from a live API-Football
// fetch just now, or the manually-maintained matches.json fallback - same
// honesty convention as /api/next-match.
app.get("/api/matches", (req, res) => {
  res.json({
    matches: MATCHES.map((m) => ({ id: m.id, label: m.label })),
    source: matchesSource,
  });
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

// ---- Live "3 most recent results" via API-Football (optional) ----
//
// Requires an API_FOOTBALL_KEY env var (free tier: dashboard.api-football.com,
// confirmed during research to cover Scottish League Two). Without a key,
// MATCHES just stays whatever matches.json says - the app works exactly as
// it did before this was added. With a key, this fetches Kelty's 3 most
// recently finished fixtures and replaces MATCHES with them, so the
// Simulation tab always reflects real, current results instead of needing
// someone to manually edit matches.json after every game.
//
// IMPORTANT: this sandbox's network proxy blocks api-sports.io the same way
// it blocks every other sports-data domain used in this project (see
// fetchLiveNextMatch above), so the live branch below has never actually
// been exercised end-to-end here - only written carefully against
// API-Football's documented v3 shape and defensively error-handled so any
// unexpected response just falls back rather than crashing. Test it for
// real once a key is set.
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
let cachedKeltyApiFootballTeamId = null;

async function apiFootballRequest(pathAndQuery) {
  const response = await fetch(`https://v3.football.api-sports.io${pathAndQuery}`, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`API-Football returned ${response.status}`);
  const data = await response.json();
  if (data.errors && Object.keys(data.errors).length) {
    throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
  }
  return data.response;
}

async function getKeltyApiFootballTeamId() {
  if (cachedKeltyApiFootballTeamId) return cachedKeltyApiFootballTeamId;
  const teams = await apiFootballRequest("/teams?search=Kelty Hearts");
  const match = teams && teams[0];
  if (!match) throw new Error("Kelty Hearts not found in API-Football team search");
  cachedKeltyApiFootballTeamId = match.team.id;
  return cachedKeltyApiFootballTeamId;
}

// Picks a plain, honest phrase for a goal based on the score right after it -
// not trying to match the flair of the hand-written historical matches
// (that took real research per goal), just avoiding nonsense like "equalises"
// when a team is actually 3 goals up.
function describeGoal(scorerIsKelty, scoreAfter) {
  const { home, away } = scoreAfter;
  const scorerScore = scorerIsKelty ? home : away;
  const otherScore = scorerIsKelty ? away : home;
  if (scorerScore === 1 && otherScore === 0) return "opens the scoring";
  if (scorerScore === otherScore) return "equalises";
  if (scorerScore === otherScore + 1) return "puts them back in front";
  return "extends the lead";
}

async function fetchOneApiFootballMatch(fixture, keltyTeamId) {
  const isHome = fixture.teams.home.id === keltyTeamId;
  const homeTeam = "Kelty Hearts"; // app-wide convention: homeTeam field is always Kelty, see matchHashtag/scoreAtMinute usage
  const awayTeam = isHome ? fixture.teams.away.name : fixture.teams.home.name;
  const venueName = fixture.fixture.venue && fixture.fixture.venue.name ? fixture.fixture.venue.name : "the ground";
  const venue = `${venueName}${isHome ? "" : " (Away)"}`;
  const competition = fixture.league.name;

  const rawEvents = (await apiFootballRequest(`/fixtures/events?fixture=${fixture.fixture.id}`)) || [];

  const events = [{ minute: 1, type: "kickoff", text: `Kick-off! ${homeTeam} vs ${awayTeam} is underway at ${venueName}.` }];
  let runningHome = 0, runningAway = 0;
  let halftimeAdded = false;

  for (const ev of rawEvents.sort((a, b) => (a.time.elapsed || 0) - (b.time.elapsed || 0))) {
    const minute = ev.time.elapsed || 1;
    const eventTeamIsKelty = ev.team.id === keltyTeamId;
    const eventTeamName = eventTeamIsKelty ? homeTeam : awayTeam;

    if (!halftimeAdded && minute >= 45) {
      events.push({
        minute: 45,
        type: "halftime",
        text: `Half-time: ${runningHome === runningAway ? "level" : runningHome > runningAway ? `${homeTeam} lead` : `${awayTeam} lead`} at ${venueName}. ${runningHome}-${runningAway}.`,
      });
      halftimeAdded = true;
    }

    if (ev.type === "Goal" && ev.detail !== "Missed Penalty") {
      if (eventTeamIsKelty) runningHome++; else runningAway++;
      const player = ev.player && ev.player.name ? ev.player.name : "Unknown";
      events.push({
        minute,
        type: "goal",
        team: eventTeamName,
        player,
        detail: describeGoal(eventTeamIsKelty, { home: runningHome, away: runningAway }),
        text: `GOAL! ${player} scores for ${eventTeamName}. ${runningHome}-${runningAway}.`,
      });
    } else if (ev.type === "Card") {
      const player = ev.player && ev.player.name ? ev.player.name : "Unknown";
      events.push({
        minute,
        type: "card",
        team: eventTeamName,
        player,
        cardType: ev.detail && ev.detail.includes("Red") ? "Red" : "Yellow",
        text: `${ev.detail || "Card"} for ${player} (${eventTeamName}).`,
      });
    } else if (ev.type === "subst") {
      events.push({
        minute,
        type: "substitution",
        team: eventTeamName,
        playerOff: ev.assist && ev.assist.name ? ev.assist.name : "",
        playerOn: ev.player && ev.player.name ? ev.player.name : "",
        text: `Substitution for ${eventTeamName}.`,
      });
    }
  }

  if (!halftimeAdded) {
    events.push({ minute: 45, type: "halftime", text: `Half-time at ${venueName}. ${runningHome}-${runningAway}.` });
  }

  const finalHome = fixture.goals.home ?? runningHome;
  const finalAway = fixture.goals.away ?? runningAway;
  const result = finalHome > finalAway ? "win" : finalHome < finalAway ? "defeat" : "draw";
  events.push({
    minute: 90,
    type: "fulltime",
    text: `FULL TIME: ${homeTeam} ${finalHome}-${finalAway} ${awayTeam}. A ${result} for ${homeTeam}.`,
  });

  return {
    id: `live-${fixture.fixture.id}`,
    label: `${homeTeam} ${finalHome}-${finalAway} ${awayTeam} (${new Date(fixture.fixture.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${isHome ? "Home" : "Away"})`,
    homeTeam,
    awayTeam,
    venue,
    competition,
    sourceNote: "Fetched live from API-Football - goal minutes and scorers come directly from the API, not hand-researched.",
    events,
  };
}

async function fetchLiveRecentMatches() {
  if (!API_FOOTBALL_KEY) throw new Error("No API_FOOTBALL_KEY set");
  const teamId = await getKeltyApiFootballTeamId();
  const fixtures = await apiFootballRequest(`/fixtures?team=${teamId}&last=3&status=FT`);
  if (!fixtures || fixtures.length === 0) throw new Error("No finished fixtures returned");

  const sorted = fixtures.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
  const matches = [];
  for (const fixture of sorted) {
    matches.push(await fetchOneApiFootballMatch(fixture, teamId));
  }
  return matches;
}

// Attempts a live refresh; on any failure, leaves MATCHES untouched (whatever
// it currently is - the matches.json fallback, or last successful live
// fetch) and just logs why, same as every other "try live" path here.
async function refreshMatches() {
  try {
    const live = await fetchLiveRecentMatches();
    MATCHES = live;
    matchesSource = "live";
    if (!MATCHES.some((m) => m.id === selectedMatchId)) {
      selectedMatchId = MATCHES[0].id;
    }
    console.log(`Refreshed matches from API-Football: ${MATCHES.map((m) => m.label).join(" | ")}`);
  } catch (error) {
    console.warn("Live match refresh failed, keeping current matches:", error.message);
  }
}

// Try once at startup, then re-check periodically so a newly-finished match
// gets picked up without needing to restart the server.
refreshMatches();
setInterval(refreshMatches, 30 * 60 * 1000);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n⚽ Kelty Hearts Live Match Social Automation running on port ${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser\n`);
});
