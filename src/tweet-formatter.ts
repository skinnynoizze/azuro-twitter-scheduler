import { Game, TweetData } from './azuro';
import { ENV, TWITTER_CONFIG } from './config';
import { logger } from './logger';

/**
 * Formats tweet text based on account type and game count
 * Limits games if needed for standard Twitter accounts
 */
export function formatTweetText(tweetData: TweetData): string {
  let tweetText = tweetData.text;
  
  // When not using NoteTweet, limit tweet content to avoid character limit
  if (!ENV.SUPPORTS_NOTETWEET && tweetData.games.length > TWITTER_CONFIG.MAX_GAMES_STANDARD_TWEET) {
    logger.info(`Limiting tweet to first ${TWITTER_CONFIG.MAX_GAMES_STANDARD_TWEET} games (total: ${tweetData.games.length} games)`);
    
    // Just keep the first part of the tweet (title and header) and append a note
    const lines = tweetText.split('\n');
    
    // Find where the game limit is reached
    let gameCount = 0;
    let cutoffIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('- ')) {
        gameCount++;
        if (gameCount > TWITTER_CONFIG.MAX_GAMES_STANDARD_TWEET) {
          cutoffIndex = i;
          break;
        }
      }
    }
    
    if (cutoffIndex > 0) {
      // Keep only lines up to the cutoff point
      const limitedLines = lines.slice(0, cutoffIndex);
      // Add note about additional games
      limitedLines.push(`\n+${tweetData.games.length - TWITTER_CONFIG.MAX_GAMES_STANDARD_TWEET} more games. Check our website for the full schedule!`);
      tweetText = limitedLines.join('\n');
    }
  }
  
  return tweetText;
}

/**
 * Generates the betting links tweet for the reply
 */
export function generateLinkTweet(tweetData: TweetData): string {
  return `Bet prematch: https://pinwin.xyz/?sport=${tweetData.sportSlug}&country=${tweetData.countrySlug}&league=${tweetData.leagueSlug}\nBet LIVE: https://pinwin.xyz/?sport=${tweetData.sportSlug}&live=true`;
} 