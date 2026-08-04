# Kelty Hearts FC — Live Match Social Media Automation

Automated system that fetches live match data and generates social media posts for Instagram, X (Twitter), and Facebook.

## How It Works

1. **Fetch live match data** from FootballData.org API
2. **Detect changes** (goals, substitutions, cards)
3. **Auto-generate posts** in 3 formats:
   - Instagram caption (engaging, emojis, hashtags)
   - X/Twitter post (short, punchy)
   - Facebook post (community-focused)
4. **User reviews & approves** each post
5. **Posts automatically** (when integrated with social media APIs)

## Setup

### Prerequisites
- Node.js (v16+)
- FootballData.org API key: https://www.football-data.org/client/register
- Claude API key: https://console.anthropic.com

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
export FOOTBALL_DATA_API_KEY='your-key-here'
export ANTHROPIC_API_KEY='your-key-here'

# 3. Start the server
npm start
```

## Files

- `server.js` — Backend API server
- `package.json` — Dependencies
- `README.md` — This file

## Status

Week 5 prototype - building live match automation with manual approval workflow.
