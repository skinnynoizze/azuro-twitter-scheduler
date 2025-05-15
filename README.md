# Azuro Twitter Scheduler

## Overview

Azuro Twitter Scheduler is a Node.js + TypeScript application that fetches sports game data and posts scheduled tweets (including images and threads) to Twitter. It does **not** use the official Twitter API, but instead leverages browser cookies and credentials via the [`agent-twitter-client`](https://www.npmjs.com/package/agent-twitter-client) ([source code](https://github.com/elizaOS/agent-twitter-client)) library to perform all Twitter actions. The app is designed for robust, automated posting of sports schedules, including support for dry runs, threads, and media uploads.

---

## Features

- **Fetches sports game data** from Azuro's GraphQL API for multiple leagues (NBA, NHL, MLB, EPL).
- **Schedules tweets** for each league, posting 1 hour before the first game of the day.
- **Posts tweets with images** (league-specific banners if available).
- **Supports threads:** Posts a main tweet with the schedule, then replies with betting links.
- **Dry run mode:** Simulate posting without sending real tweets.
- **NoteTweet support:** Optionally post long tweets (for Twitter Blue accounts).
- **Robust authentication:** Uses Twitter cookies first, then falls back to credentials if needed.
- **Comprehensive logging** for all actions and errors.

---

## Implementation Details

### Twitter Posting
- Uses [`agent-twitter-client`](https://www.npmjs.com/package/agent-twitter-client) ([GitHub](https://github.com/elizaOS/agent-twitter-client)) for all Twitter actions.
- Always tries to authenticate with cookies first; if not logged in, falls back to username/password (and optional email).
- Supports posting regular tweets, NoteTweets (long tweets), replies (for threads), and media uploads.
- Dry run mode is fully supported and logs all actions without posting.

### Scheduling
- Each league has a configurable daily posting time (CET timezone by default).
- Tweets are scheduled 1 hour before the first game of the day for each league.
- On startup, you can optionally fetch/schedule or post immediately using environment variables.

### Game Data
- Fetches game schedules from Azuro's public GraphQL endpoint.
- Formats tweets with league-specific titles, game times (in multiple timezones), and team matchups.
- Attaches a league image if available in the `assets/` directory.

---

## Environment Variables

Set these in your `.env` file:

| Variable                  | Description                                                      |
|---------------------------|------------------------------------------------------------------|
| `TWITTER_COOKIES_AUTH_TOKEN` | Twitter `auth_token` cookie value (required)                  |
| `TWITTER_COOKIES_CT0`         | Twitter `ct0` cookie value (required)                        |
| `TWITTER_COOKIES_GUEST_ID`    | Twitter `guest_id` cookie value (required)                   |
| `TWITTER_USERNAME`            | Twitter username (required, for fallback login)              |
| `TWITTER_PASSWORD`            | Twitter password (optional, for fallback login)              |
| `TWITTER_EMAIL`               | Twitter email (optional, for fallback login)                 |
| `TWITTER_DRY_RUN`             | Set to `true` to enable dry run mode (no real tweets)        |
| `RUN_ON_START`                | Set to `true` to fetch and schedule all leagues on startup   |
| `POST_ON_START`               | Set to `true` to post tweets for all leagues on startup      |
| `SUPPORTS_NOTETWEET`          | Set to `true` to use NoteTweet (long tweet) if supported     |

---

## Usage

1. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Set up your `.env` file** with the required Twitter cookies and credentials.

3. **Add league images** (optional):
   - Place PNG images named `NBA_GAMEDAY.png`, `NHL_GAMEDAY.png`, `MLB_GAMEDAY.png`, `EPL_GAMEDAY.png` in the `assets/` directory for richer tweets.

4. **Run the app:**
   ```bash
   npm run build && npm start
   # or
   pnpm build && pnpm start
   ```

5. **Check logs** for info, errors, and dry run output.

---

## Project Structure

```
azuro-twitter-scheduler/
  assets/           # League images (optional)
  src/
    azuro.ts        # Game data fetching and formatting
    config.ts       # Configuration settings
    index.ts        # App entry point
    logger.ts       # Logging functionality
    media.ts        # Media handling utilities
    scheduler.ts    # Scheduling and posting logic
    tweet-formatter.ts # Tweet formatting utilities
    twitter.ts      # Twitter client integration
  .env.example      # Example environment variables template
  package.json      # Project metadata and dependencies
  README.md         # This documentation file
  tsconfig.json     # TypeScript configuration
```

> **Note:** To configure the app, copy `.env.example` to `.env` and fill in your credentials.

---

## Troubleshooting
- **Dry run mode:** If `TWITTER_DRY_RUN=true`, tweets will not be posted, but all logic and logs will run as if they were.
- **Authentication errors:** Double-check your Twitter cookies and credentials.
- **Media/image issues:** Ensure your image files exist and are under 5MB.
- **No games found:** The app only posts if there are games scheduled for the day.

---

## Credits
- [`agent-twitter-client`](https://www.npmjs.com/package/agent-twitter-client) ([GitHub](https://github.com/elizaOS/agent-twitter-client)) for Twitter automation.
- Azuro Protocol for sports data.

---

## License
MIT 