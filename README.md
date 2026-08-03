# Kelty Hearts FC — Fan Q&A Assistant

A simple AI assistant that answers common fan questions about Kelty Hearts FC.

## What This Does

**Problem:** Fans ask the same questions repeatedly (when's the next match, where to buy tickets, can I bring kids?).

**Solution:** A chat-style Q&A tool. Fans type a question in plain English, and the assistant answers from a knowledge base of FAQs about the club.

**What It Knows:**
- Match fixtures and kick-off times
- Ticket prices and where to buy
- Stadium location and how to get there
- Membership info
- Family-friendly policies
- Food/refreshments available
- Group bookings

## How It Works

1. Fan opens the chat interface
2. They ask a question (or click a suggested question)
3. The tool searches the knowledge base for matching keywords
4. It returns the relevant answer instantly
5. No AI generation needed—it just matches questions to pre-written answers

**Why This Approach?**
- Super fast (no external API calls needed)
- 100% accurate (no AI hallucinations)
- Easy to update (just edit `knowledge_base.json`)
- Offline-capable (works without internet once loaded)

## Setup & Running

### Prerequisites
- Node.js (v16+) installed

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
# Go to http://localhost:3000
```

The server runs on port 3000 and opens the chat interface.

### Development Mode
```bash
npm run dev
# Auto-restarts the server when you edit code
```

## How to Test

1. Start the server (`npm start`)
2. Open http://localhost:3000 in your browser
3. Try asking the suggested questions or type your own
4. Test questions like:
   - "When is the next home game?"
   - "Where do I buy tickets?"
   - "Can I bring my kids?"
   - "How do I become a member?"

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

## Project Files

- `fan_assistant.html` — The chat interface for fans
- `knowledge_base.json` — FAQ database (edit this to add/update questions)
- `server.js` — Handles Q&A requests
- `package.json` — Dependencies and start commands
- `README.md` — This file

## Questions?

The tool uses simple keyword matching to find answers—no AI needed. This makes it fast, reliable, and easy to control exactly what gets said to fans.

---

**Status:** Week 5 testing phase — focused on one simple, working tool that fans can actually use.
