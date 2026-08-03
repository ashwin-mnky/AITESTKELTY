# Kelty Hearts FC — AI Prototype

A Week 5 internship prototype demonstrating two AI ideas for Kelty Hearts FC:
1. **Automated Match Report Drafting** ✅ Complete
2. **Mini AI Assistant (Fan Q&A)** (To build after testing #1)

## What This Does

### Idea #1: Match Report Generator

**The Problem:** Writing a match report manually takes time. Staff copy facts from BBC Sport, then write it up—repetitive work.

**The Solution:** Paste a BBC Sport live match page (the text or HTML), and the AI generates a warm, friendly draft report in under a minute. A human still edits and approves it before publishing.

**What It Extracts from BBC:**
- Final score
- Goal scorers + minute
- Cards (yellow/red) + player
- Substitutions (if visible)
- Opponent name
- Home/away venue

**What It Outputs:**
A ~150-250 word draft report in a community-first tone (like the club's own voice, not corporate marketing-speak). It's a first draft—meant to be edited by a human, not published as-is.

**How to Use:**
1. Run the server (`npm start`)
2. Open http://localhost:3000 in a browser
3. Go to a BBC Sport live match page (e.g., https://www.bbc.com/sport/football/live/cre4772jgl2t)
4. Scroll to the bottom, select all the page content (Ctrl+A), copy it
5. Paste it into the form and hit "Generate Report"
6. The AI extracts match facts and writes a draft
7. Copy the report, paste it into your CMS/email, and edit as needed

### Idea #2: Mini AI Assistant (Q&A) ✅ Complete

**The Problem:** Fans ask the same questions repeatedly (when's the next match, where to buy tickets, can I bring kids?).

**The Solution:** A simple chat-style Q&A tool. Fans type a question in plain English, and the assistant answers from a knowledge base of FAQs about the club.

**What It Knows:**
- Match fixtures and kick-off times
- Ticket prices and where to buy
- Stadium location and how to get there
- Membership info
- Family-friendly policies
- Food/refreshments
- Group bookings

**How It Works:**
1. Fan asks: "When's the next home game?"
2. The tool searches the knowledge base for matching keywords
3. It returns the relevant answer in a friendly chat format
4. No AI generation needed—it just matches questions to pre-written answers

**How to Use:**
1. Run the server (`npm start`)
2. Open http://localhost:3000/assistant in your browser
3. Click a suggested question or type your own
4. Get instant answers

**Why This Approach?**
- Super fast (no external API calls)
- 100% accurate (no AI hallucinations)
- Easy to update (just edit knowledge_base.json)
- Offline-capable (works without internet once loaded)

## Technical Details (Plain Language)

**Underneath, here's what happens:**

1. **Frontend (the website you see):** A simple form where you paste BBC content.
2. **Parsing:** The app looks for patterns in the pasted text—things like "2-1" (score), player names + apostrophe + number (goal times), etc.
3. **AI Generation:** It sends those facts to Claude (Anthropic's AI) with a prompt that says "write this like a small Scottish club's media team, warm and community-focused."
4. **Output:** You get a draft report to copy and edit.

**Why BBC Copy-Paste Instead of Direct Scraping?**
BBC Sport blocks automated scraping to protect their site. Rather than getting stuck on that technical problem, we copy-paste the page for now. If this idea gets greenlit, the club can invest in proper API access or use a third-party scraper tool—but the AI logic stays the same.

## Setup & Running

### Prerequisites
- Node.js (v16+) installed
- An Anthropic API key (set as `ANTHROPIC_API_KEY` environment variable)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
# Match Report Generator: http://localhost:3000/
# Fan Q&A Assistant:      http://localhost:3000/assistant
```

The server runs on port 3000 and serves both tools.

### Development Mode
```bash
npm run dev
# Auto-restarts the server when you edit code
```

## How to Test

**Test Case 1: Extract a real BBC match page**
1. Go to https://www.bbc.com/sport/football/live/ (live matches)
2. Find a Scottish League Two or other football match
3. Copy the page content and paste into the form
4. See if the report makes sense

**Test Case 2: Use sample content** (in `sample_bbc_content.txt`)
- This is fake but realistic BBC-style match content
- Great for testing without needing a live match

## Project Files

**Match Report Generator (Idea #1):**
- `match_report_generator.html` — The form where you paste BBC content
- `sample_bbc_content.txt` — Example BBC content for testing

**Fan Q&A Assistant (Idea #2):**
- `fan_assistant.html` — The chat interface for fans
- `knowledge_base.json` — FAQ database (edit this to add/update questions)

**Backend:**
- `server.js` — Handles both tools (report generation + Q&A)
- `package.json` — Dependencies and start commands
- `README.md` — This file

## Customizing the Q&A Tool

The knowledge base is in `knowledge_base.json`. To add or change questions:

1. Open `knowledge_base.json` in a text editor
2. Add a new FAQ object to the `faqs` array:
```json
{
  "question": "what is your example question",
  "keywords": ["example", "question", "words", "to", "match"],
  "answer": "This is the answer that will be shown to fans."
}
```
3. Save the file
4. Restart the server (`npm start`)

**Tips:**
- Keep keywords lowercase and relevant
- More keywords = better matching
- The tool looks for keyword matches first, then word overlap
- If a question doesn't match well enough, it shows the fallback message

## What Happens Next

**Week 5 Demo:**
1. ✅ Match Report Generator — built and tested
2. ✅ Fan Q&A Assistant — built and tested
3. Show both to Kelty Hearts staff to get feedback
4. Gather requirements for scaling or improving either tool

**Future Options (if approved):**
- Connect the Q&A to a real FAQ database or CMS
- Add more sophisticated matching (semantic search with AI)
- Link reports directly to the club website
- Set up automated match report posting

## Questions?

The code uses **Claude Opus** (Anthropic's most capable model) to generate reports. If a match page has incomplete data (e.g., substitutions aren't shown), the report will note what's known and work with that—it's a draft, not a complete game analysis.

---

**Status:** Week 5 prototype — keeps it simple and testable. Not production-ready, but good enough to demonstrate the concept and get feedback.
