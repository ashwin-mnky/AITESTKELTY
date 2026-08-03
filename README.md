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

### Idea #2: Mini AI Assistant (Q&A)

Coming next (once #1 is tested and working).

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
# Go to http://localhost:3000
```

The server runs on port 3000. You'll see a form where you paste BBC content.

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

- `match_report_generator.html` — The form/website you see in the browser
- `server.js` — The backend that calls Claude and processes requests
- `package.json` — Lists dependencies and start commands
- `sample_bbc_content.txt` — Example BBC content for testing
- `README.md` — This file

## What Happens Next

Once this is working:
1. Test it with a real BBC match from this weekend (Scottish lower leagues)
2. Show it to Kelty Hearts staff to get feedback on tone/format
3. If approved, build **Idea #2: Mini AI Assistant** (Q&A tool)
4. Both together form the Week 5 demo

## Questions?

The code uses **Claude Opus** (Anthropic's most capable model) to generate reports. If a match page has incomplete data (e.g., substitutions aren't shown), the report will note what's known and work with that—it's a draft, not a complete game analysis.

---

**Status:** Week 5 prototype — keeps it simple and testable. Not production-ready, but good enough to demonstrate the concept and get feedback.
