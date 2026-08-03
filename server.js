import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const client = new Anthropic();

app.use(express.json());
app.use(express.static(__dirname));

// Main endpoint: Generate match report
app.post("/api/generate-report", async (req, res) => {
  try {
    const { prompt, matchInfo } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-1",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const report =
      response.content[0].type === "text" ? response.content[0].text : "";

    res.json({
      report,
      matchInfo,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({
      error: "Failed to generate report",
      details: error.message,
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚽ Kelty Hearts Match Report Generator running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
