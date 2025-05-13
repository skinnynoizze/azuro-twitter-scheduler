// scheduler.ts
import { TwitterClient } from './twitter';
import { azuroProvider, leagues } from './azuro';
import dotenv from 'dotenv';
import { logger } from './logger';
import { prepareMediaData } from './media';

// Load environment variables
dotenv.config();

const RUN_ON_START = process.env.RUN_ON_START === 'true';
const POST_ON_START = process.env.POST_ON_START === 'true';
const SUPPORTS_NOTETWEET = process.env.SUPPORTS_NOTETWEET === 'true';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

export class AzuroScheduler {
    private leagueSchedules: Map<string, NodeJS.Timeout> = new Map();
    private twitterClient: TwitterClient;

    constructor() {
        // Initialize Twitter client
        this.twitterClient = new TwitterClient({
            cookies: {
                auth_token: requireEnv('TWITTER_COOKIES_AUTH_TOKEN'),
                ct0: requireEnv('TWITTER_COOKIES_CT0'),
                guest_id: requireEnv('TWITTER_COOKIES_GUEST_ID')
            },
            username: requireEnv('TWITTER_USERNAME'),
            isDryRun: process.env.TWITTER_DRY_RUN === 'true'
        });

        logger.info('[INFO] AzuroScheduler initialized with Twitter client');
    }

    /**
     * Start the scheduler for all leagues
     */
    start() {
        // League fetch times (in CET)
        const leagueFetchTimes = {
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
                fetchHour: 11, // 11:00 CET (12:00 ESPAÑA de la mañana)
                fetchMinute: 0,
                timeZone: "Europe/Madrid"
            }
        };

        // Set up scheduled fetches
        logger.info('[INFO] Setting up scheduled fetches');
        for (const [league, config] of Object.entries(leagueFetchTimes)) {
            this.setupLeagueScheduler(league, config);
        }

        // If RUN_ON_START is true, fetch and schedule all leagues immediately
        if (RUN_ON_START) {
            logger.info('[INFO] RUN_ON_START is true: Fetching and scheduling all leagues immediately.');
            for (const league of Object.keys(leagues)) {
                this.fetchAndScheduleLeague(league);
            }
        }

        // If POST_ON_START is true, fetch and post all leagues immediately
        if (POST_ON_START) {
            logger.info('[INFO] POST_ON_START is true: Posting tweets for all leagues immediately.');
            for (const league of Object.keys(leagues)) {
                azuroProvider.getGames(leagues[league as keyof typeof leagues].leagueId).then(gamesData => {
                    const leagueTweetData = gamesData.tweets.find(
                        t => t.leagueId === leagues[league as keyof typeof leagues].leagueId
                    );
                    if (leagueTweetData) {
                        this.postLeagueTweet(leagueTweetData);
                    } else {
                        logger.info(`[INFO] No tweet data to post for ${league}`);
                    }
                });
            }
        }

        logger.info('[INFO] AzuroScheduler started successfully');
    }

    /**
     * Set up scheduler for a specific league
     */
    private setupLeagueScheduler(league: string, config: { fetchHour: number, fetchMinute: number, timeZone: string }) {
        const now = new Date();
        const targetTime = new Date(now);
        targetTime.setHours(config.fetchHour, config.fetchMinute, 0, 0);

        // If target time has passed today, schedule for tomorrow
        if (now > targetTime) {
            targetTime.setDate(targetTime.getDate() + 1);
        }

        const timeUntilNextFetch = targetTime.getTime() - now.getTime();
        
        logger.info(`[INFO] Scheduling ${league} fetch at ${targetTime.toISOString()} (in ${Math.round(timeUntilNextFetch/1000/60)} minutes)`);

        // Schedule the first fetch
        const timeout = setTimeout(() => {
            this.fetchAndScheduleLeague(league);
            // Set up recurring fetch
            this.leagueSchedules.set(league, setInterval(() => {
                this.fetchAndScheduleLeague(league);
            }, 24 * 60 * 60 * 1000)); // 24 hours
        }, timeUntilNextFetch);

        this.leagueSchedules.set(league, timeout);
    }

    /**
     * Fetch games for a league and schedule tweets
     */
    async fetchAndScheduleLeague(league: string) {
        try {
            logger.info(`[INFO] Fetching games for ${league}`);
            
            const gamesData = await azuroProvider.getGames(leagues[league as keyof typeof leagues].leagueId);

            if (!gamesData || !gamesData.tweets || gamesData.tweets.length === 0) {
                logger.info(`[INFO] No games found for ${league}`);
                return;
            }

            // Match using leagueId
            const leagueTweetData = gamesData.tweets.find(t => t.leagueId === leagues[league as keyof typeof leagues].leagueId);
            if (!leagueTweetData) {
                logger.info(`[INFO] No tweet data found for ${league}`);
                return;
            }

            const firstGame = leagueTweetData.games?.[0];
            if (!firstGame) {
                logger.info(`[INFO] No games found in tweet data for ${league}`);
                return;
            }

            // Schedule post for 1 hour before the first game
            const postTime = Number(firstGame.startsAt) * 1000 - (60 * 60 * 1000);
            const timeUntilPost = postTime - Date.now();
            
            if (timeUntilPost > 0) {
                logger.info(`[INFO] Scheduling ${league} post for ${new Date(postTime).toISOString()}`, {
                    firstGameTime: new Date(Number(firstGame.startsAt) * 1000).toISOString(),
                    scheduledPostTime: new Date(postTime).toISOString(),
                    timeUntilPost: `${Math.floor(timeUntilPost / 1000 / 60)} minutes`
                });
                
                setTimeout(() => {
                    this.postLeagueTweet(leagueTweetData);
                }, timeUntilPost);
            } else {
                logger.info(`[WARN] Cannot schedule ${league} post - first game starts too soon`);
            }

        } catch (error) {
            logger.error(`[ERROR] Error fetching and scheduling ${league}:`, error);
        }
    }

    /**
     * Post a league tweet with its attachments
     */
    async postLeagueTweet(tweetData: any) {
        try {
            logger.info("[INFO] Attempting to post league tweet...");

            // Prepare media data if there are attachments
            let mediaData = null;
            if (tweetData.attachments && tweetData.attachments.length > 0) {
                logger.info("[INFO] Processing image attachments for tweet");
                mediaData = await prepareMediaData(tweetData.attachments);
                logger.info("[INFO] Media data prepared successfully");
            }

            let tweetResult, firstTweetId;
            if (SUPPORTS_NOTETWEET) {
                logger.info("[INFO] SUPPORTS_NOTETWEET is true: Using NoteTweet.");
                const noteTweetResult = await this.twitterClient.sendNoteTweet(
                    tweetData.text,
                    undefined,
                    mediaData ?? undefined
                );
                tweetResult = noteTweetResult.data.notetweet_create.tweet_results.result;
                firstTweetId = tweetResult.rest_id;
                logger.info("[INFO] NoteTweet successfully posted with ID:", firstTweetId);
            } else {
                logger.info("[INFO] SUPPORTS_NOTETWEET is false: Using standard Tweet.");
                const tweetResponse = await this.twitterClient.sendTweet(
                    tweetData.text,
                    undefined,
                    mediaData ?? undefined
                );
                const tweetBody = await tweetResponse.json();
                tweetResult = tweetBody.data.create_tweet.tweet_results.result;
                firstTweetId = tweetResult.rest_id;
                logger.info("[INFO] Tweet successfully posted with ID:", firstTweetId);
            }

            // Wait a bit before posting the reply
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Second tweet with dynamic links specific to this league
            const linkTweet = `Bet prematch: https://pinwin.xyz/?sport=${tweetData.sportSlug}&country=${tweetData.countrySlug}&league=${tweetData.leagueSlug}\nBet LIVE: https://pinwin.xyz/?sport=${tweetData.sportSlug}&live=true`;
            
            logger.info("[INFO] Posting reply tweet with betting links...");
            
            // Post reply using first tweet's ID
            const replyResult = await this.twitterClient.sendTweet(
                linkTweet,
                firstTweetId
            );

            const replyBody = await replyResult.json();
            
            if (replyBody?.data?.create_tweet?.tweet_results?.result) {
                logger.info("[INFO] Thread complete for league", {
                    mainTweetId: firstTweetId,
                    replyTweetId: replyBody.data.create_tweet.tweet_results.result.rest_id
                });
            } else {
                logger.error("[ERROR] Failed to post reply tweet:", replyBody);
            }
        } catch (error) {
            logger.error("[ERROR] Error posting league tweet:", error);
        }
    }

    /**
     * Stop all schedulers
     */
    stop() {
        // Clear all league schedules
        for (const timeout of this.leagueSchedules.values()) {
            clearTimeout(timeout);
        }
        this.leagueSchedules.clear();
        logger.info("[INFO] AzuroScheduler stopped");
    }
}