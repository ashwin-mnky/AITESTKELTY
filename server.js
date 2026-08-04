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

const matchData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "match_data.json"), "utf-8")
);

// How fast the simulated match plays out: 1 match-minute = SECONDS_PER_MINUTE real seconds
const SECONDS_PER_MINUTE = 2;

let simulationStartTime = null;

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// Reset/start the simulated live match clock
app.post("/api/start", (req, res) => {
  simulationStartTime = Date.now();
  res.json({ started: true });
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
  const lastMinute = matchData.events[matchData.events.length - 1].minute;

  if (!simulationStartTime) {
    return res.json({ events: [], finished: false, currentMinute: 0, score: { home: 0, away: 0 } });
  }

  const elapsedSeconds = (Date.now() - simulationStartTime) / 1000;
  const elapsedMinutes = elapsedSeconds / SECONDS_PER_MINUTE;

  const events = matchData.events
    .filter((e) => e.minute <= elapsedMinutes)
    .filter((e) => !e.team || e.team === matchData.homeTeam);

  const finished = elapsedMinutes >= lastMinute;
  const currentMinute = Math.min(lastMinute, Math.floor(elapsedMinutes));
  const score = scoreAtMinute(elapsedMinutes);

  res.json({ events, finished, currentMinute, score });
});

// Match metadata so the frontend never has to hardcode team names
app.get("/api/match-info", (req, res) => {
  res.json({
    homeTeam: matchData.homeTeam,
    awayTeam: matchData.awayTeam,
    venue: matchData.venue,
    competition: matchData.competition,
  });
});

// Generate Instagram / X / Facebook posts for a single match event.
//
// Normally this uses the loaded match_data.json (the simulated live match).
// But the caller can instead pass `context: { awayTeam, venue, score }` to
// generate a post for a completely different, made-up match on the fly -
// proving the template/generation logic isn't tied to any one game. Only
// `homeTeam` is fixed to "Kelty Hearts"; everything else is parameterized.
app.post("/api/generate-posts", async (req, res) => {
  try {
    const { event, context } = req.body;

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
          homeTeam: matchData.homeTeam,
          awayTeam: matchData.awayTeam,
          venue: matchData.venue,
          score: scoreAtMinute(event.minute),
        };

    let posts = null;

    if (hasApiKey) {
      const scoreLine = `${match.score.home}-${match.score.away} | ${matchHashtag(match.homeTeam, match.awayTeam)}`;
      const prompt = `You are the social media team for Kelty Hearts FC, a Scottish League Two football club. A live match event just happened:

"${event.text}"

Kelty Hearts' real posts follow this exact house style — minute, short punchy headline, blank line, brief factual detail, blank line, score + match hashtag. For example, real posts from their account look like:

"80' | Substitutions for Kelty Hearts

1-0 | #FORKEL"

"91' | GOOOOOAAALLLLLLL

It's Finlay Moffat who scores a low range effort from the left side of the box!!

3-2 | #KELBRO"

Match that exact structure and tone (short, punchy, minute-led, dramatic on goals) for this event. The score line to use is: "${scoreLine}"

Write three versions in this house style. Return ONLY valid JSON in this exact shape, no other text:

{
  "instagram": "same house-style post, with 1-2 relevant emojis added",
  "x": "the post exactly in house style, no extra emojis needed",
  "facebook": "same house-style post, with one warm extra sentence inviting fans to follow along"
}`;

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
      posts = fallbackPosts(event, match);
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

// Score at a given match minute, computed from goal events so far.
function scoreAtMinute(minute) {
  let home = 0;
  let away = 0;
  for (const e of matchData.events) {
    if (e.type === "goal" && e.minute <= minute) {
      if (e.team === matchData.homeTeam) home++;
      else away++;
    }
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

// Free, no-API-key-required post generator, matching Kelty Hearts' real
// posting house style (minute | headline, blank line, detail, blank line,
// score | match hashtag). Used automatically whenever ANTHROPIC_API_KEY
// isn't set (or the AI call fails), so the tool always works.
//
// `match` is { homeTeam, awayTeam, venue, score } - this function has no
// idea whether it's the loaded simulation or a one-off match someone typed
// in through the "test with a different match" panel. Same code, any match.
function fallbackPosts(event, match) {
  const { homeTeam, awayTeam, venue, score } = match;
  const hashtag = matchHashtag(homeTeam, awayTeam);
  const scoreLine = `${score.home}-${score.away} | ${hashtag}`;
  let body;

  switch (event.type) {
    case "kickoff":
      body = `${event.minute}' | Kick-off!\n\n${homeTeam} v ${awayTeam} is underway at ${venue}.\n\n0-0 | ${hashtag}`;
      break;

    case "goal": {
      const detail = event.detail || "a well-taken finish";
      body = `${event.minute}' | GOOOOOAAALLLLLLL\n\nIt's ${event.player} who scores with ${detail}!!\n\n${scoreLine}`;
      break;
    }

    case "card":
      body = `${event.minute}' | ${event.cardType} card for ${event.player} (${event.team})\n\n${scoreLine}`;
      break;

    case "substitution": {
      const offLine = event.playerOff ? `Off: ${event.playerOff}\n` : "";
      body = `${event.minute}' | Substitution for ${event.team}\n\n${offLine}On: ${event.playerOn}\n\n${scoreLine}`;
      break;
    }

    case "halftime": {
      const state = score.home > score.away ? `${homeTeam} ahead` : score.home < score.away ? `${homeTeam} behind` : "Level";
      body = `HT | ${state} at ${venue}.\n\n${scoreLine}`;
      break;
    }

    case "fulltime": {
      const result = score.home > score.away ? "win" : score.home < score.away ? "defeat" : "draw";
      body = `FT | Full-time ${result} for ${homeTeam} against ${awayTeam}.\n\n${scoreLine}`;
      break;
    }

    default:
      body = `${event.minute}' | ${event.text}\n\n${scoreLine}`;
  }

  return {
    instagram: `${body}\n\n💚🤍`,
    x: body,
    facebook: `${body}\n\nCome along and follow the team! #KeltyHearts`,
  };
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n⚽ Kelty Hearts Live Match Social Automation running on port ${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser\n`);
});
