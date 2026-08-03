import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const client = new Anthropic();

// Load knowledge base
const knowledgeBase = JSON.parse(
  fs.readFileSync(path.join(__dirname, "knowledge_base.json"), "utf-8")
);

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

// Q&A endpoint: Answer fan questions from knowledge base
app.post("/api/ask-question", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    // Find best matching FAQ
    const answer = findBestAnswer(question);

    res.json({ answer });
  } catch (error) {
    console.error("Error answering question:", error);
    res.status(500).json({
      error: "Failed to answer question",
      details: error.message,
    });
  }
});

// Find the best matching answer from knowledge base
function findBestAnswer(question) {
  const lowerQuestion = question.toLowerCase();

  // Score each FAQ
  let bestMatch = null;
  let bestScore = 0;

  for (const faq of knowledgeBase.faqs) {
    let score = 0;

    // Check if any keywords match
    for (const keyword of faq.keywords) {
      if (lowerQuestion.includes(keyword)) {
        score += 10; // Keyword match is worth 10 points
      }
    }

    // Simple similarity: count matching words
    const questionWords = lowerQuestion.split(/\s+/);
    const faqWords = faq.question.toLowerCase().split(/\s+/);

    for (const word of questionWords) {
      if (faqWords.includes(word) && word.length > 3) {
        score += 5; // Word match is worth 5 points
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  // If we found a good match (score > 5), return it
  if (bestMatch && bestScore > 5) {
    return bestMatch.answer;
  }

  // Default fallback answer
  return `Thanks for your question! I didn't quite understand that. Try asking me about: tickets, match times, stadium location, membership, family visits, or getting to the ground. Or email us at ${knowledgeBase.general_info.email}`;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Route to serve fan assistant
app.get("/assistant", (req, res) => {
  res.sendFile(path.join(__dirname, "fan_assistant.html"));
});

// Route to serve match report generator
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "match_report_generator.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n⚽ Kelty Hearts AI Prototype running on port ${PORT}\n`);
  console.log(`  📝 Match Report Generator: http://localhost:${PORT}/`);
  console.log(`  💬 Fan Q&A Assistant: http://localhost:${PORT}/assistant\n`);
});
