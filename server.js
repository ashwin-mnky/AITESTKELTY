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

// Returns events that have "happened" so far in simulated time
app.get("/api/live-feed", (req, res) => {
  if (!simulationStartTime) {
    return res.json({ events: [], finished: false });
  }

  const elapsedSeconds = (Date.now() - simulationStartTime) / 1000;
  const elapsedMinutes = elapsedSeconds / SECONDS_PER_MINUTE;

  const events = matchData.events.filter((e) => e.minute <= elapsedMinutes);
  const finished = events.length === matchData.events.length;

  res.json({ events, finished });
});

// Generate Instagram / X / Facebook posts for a single match event
app.post("/api/generate-posts", async (req, res) => {
  try {
    const { event } = req.body;

    if (!event) {
      return res.status(400).json({ error: "Event is required" });
    }

    let posts = null;

    if (hasApiKey) {
      const prompt = `You are the social media team for Kelty Hearts FC, a Scottish League Two football club. A live match event just happened:

"${event.text}"

Write three short social media posts announcing this event, in a warm, community-first tone (not corporate). Return ONLY valid JSON in this exact shape, no other text:

{
  "instagram": "post text with relevant emojis and hashtags, 2-3 sentences",
  "x": "short punchy post under 280 characters, 1-2 emojis, 1-2 hashtags",
  "facebook": "slightly longer, community-focused post, 2-4 sentences"
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
      posts = fallbackPosts(event);
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

// Free, no-API-key-required post generator. Used automatically whenever
// ANTHROPIC_API_KEY isn't set (or the AI call fails), so the tool always works.
function fallbackPosts(event) {
  const emojiByType = {
    goal: "⚽",
    card: event.cardType === "Red" ? "🟥" : "🟨",
    substitution: "🔄",
    kickoff: "⚽",
    halftime: "⏸️",
    fulltime: "🏁",
  };
  const emoji = emojiByType[event.type] || "📣";
  const fact = event.text;

  return {
    instagram: `${emoji} ${fact}\n\n💚🤍 #KeltyHearts #ScottishFootball #COYH`,
    x: `${emoji} ${fact} #KeltyHearts`,
    facebook: `${emoji} ${fact}\n\nFollow along for more updates from New Central Park. #KeltyHearts`,
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
