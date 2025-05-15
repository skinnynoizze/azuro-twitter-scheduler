import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment variables
export const ENV = {
  RUN_ON_START: process.env.RUN_ON_START === 'true',
  POST_ON_START: process.env.POST_ON_START === 'true',
  SUPPORTS_NOTETWEET: process.env.SUPPORTS_NOTETWEET === 'true',
  TWITTER_DRY_RUN: process.env.TWITTER_DRY_RUN === 'true',
};

// Twitter-specific constants
export const TWITTER_CONFIG = {
  // Time to wait between tweets in a thread (ms)
  THREAD_DELAY_MS: 2000,
  
  // Maximum games to include in a standard tweet
  MAX_GAMES_STANDARD_TWEET: 5,
};

// League configuration
export const LEAGUE_FETCH_TIMES = {
  EPL: {
      fetchHour: 10, // 10:00 CET (11:00 ESPAÑA de la mañana)
      fetchMinute: 0,
      timeZone: "Europe/Madrid"
  },
  NBA: {
      fetchHour: 15, // 15:00 CET (16:00 ESPAÑA de la tarde)
      fetchMinute: 0,
      timeZone: "Europe/Madrid"
  },
  NHL: {
      fetchHour: 11, // 11:00 CET (12:00 ESPAÑA de la mañana)
      fetchMinute: 0,
      timeZone: "Europe/Madrid"
  },
  MLB: {
      fetchHour: 12, // 12:00 CET (13:00 ESPAÑA de la mañana)
      fetchMinute: 0,
      timeZone: "Europe/Madrid"
  }
};

// Helper function to require environment variables
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
} 