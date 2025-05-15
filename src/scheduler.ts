// scheduler.ts
import { TwitterClient } from './twitter';
import { azuroProvider, leagues, Game, TweetData } from './azuro';
import { logger } from './logger';
import { prepareMediaData } from './media';
import { ENV, TWITTER_CONFIG, LEAGUE_FETCH_TIMES, requireEnv } from './config';
import { formatTweetText, generateLinkTweet } from './tweet-formatter';

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
            isDryRun: ENV.TWITTER_DRY_RUN
        });

        logger.info('AzuroScheduler initialized with Twitter client');
    }

    /**
     * Start the scheduler for all leagues
     */
    start() {
        // Set up scheduled fetches
        logger.info('Setting up scheduled fetches');
        for (const [league, config] of Object.entries(LEAGUE_FETCH_TIMES)) {
            this.setupLeagueScheduler(league, config);
        }

        // If RUN_ON_START or POST_ON_START is true, fetch leagues immediately
        if (ENV.RUN_ON_START || ENV.POST_ON_START) {
            logger.info('Immediate startup actions triggered');
            
            // Fetch games for all leagues once
            const fetchPromises = Object.keys(leagues).map(async (league) => {
                const leagueKey = league as keyof typeof leagues;
                
                logger.info(`Fetching games for ${league}`);
                const gamesData = await azuroProvider.getGames(leagues[leagueKey].leagueId);
                
                // Store fetched data for both scheduling and posting
                if (gamesData && gamesData.tweets && gamesData.tweets.length > 0) {
                    const leagueTweetData = gamesData.tweets.find(
                        t => t.leagueId === leagues[leagueKey].leagueId
                    );
                    
                    if (leagueTweetData) {
                        // Schedule future tweets if RUN_ON_START is true
                        if (ENV.RUN_ON_START) {
                            this.scheduleLeagueTweet(league, leagueTweetData);
                        }
                        
                        // Post immediately if POST_ON_START is true
                        if (ENV.POST_ON_START) {
                            logger.info(`Posting tweet for ${league} immediately`);
                            this.postLeagueTweet(leagueTweetData);
                        }
                    } else {
                        logger.info(`No tweet data found for ${league}`);
                    }
                } else {
                    // Don't log "No games found" - azuroProvider already logs this
                    // Just log debug info for tracking which league was checked
                    logger.info(`Checked ${league} league`);
                }
            });
            
            // Wait for all fetches to complete
            Promise.all(fetchPromises).catch(err => {
                logger.error('Error during startup fetches:', err);
            });
        }

        logger.info('AzuroScheduler started successfully');
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
        
        logger.info(`Scheduling ${league} fetch at ${targetTime.toISOString()} (in ${Math.round(timeUntilNextFetch/1000/60)} minutes)`);

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
            logger.info(`Fetching games for ${league}`);
            
            const gamesData = await azuroProvider.getGames(leagues[league as keyof typeof leagues].leagueId);

            if (!gamesData || !gamesData.tweets || gamesData.tweets.length === 0) {
                // Don't log "No games found" - azuroProvider already logs this
                // Just log debug info for tracking which league was checked
                logger.info(`Checked ${league} league`);
                return;
            }

            // Match using leagueId
            const leagueTweetData = gamesData.tweets.find(t => t.leagueId === leagues[league as keyof typeof leagues].leagueId);
            if (!leagueTweetData) {
                logger.info(`No tweet data found for ${league}`);
                return;
            }
            
            // Schedule the tweet using our helper method
            this.scheduleLeagueTweet(league, leagueTweetData);

        } catch (error) {
            logger.error(`Error fetching and scheduling ${league}:`, error);
        }
    }

    /**
     * Post a league tweet with its attachments
     */
    async postLeagueTweet(tweetData: TweetData) {
        try {
            logger.info("Attempting to post league tweet...");

            // Prepare media data if there are attachments
            let mediaData = null;
            if (tweetData.attachments && tweetData.attachments.length > 0) {
                logger.info("Processing image attachments for tweet");
                mediaData = await prepareMediaData(tweetData.attachments);
                logger.info("Media data prepared successfully");
            }

            // Format tweet text (handles game limiting for non-Blue accounts)
            const tweetText = formatTweetText(tweetData);

            let tweetResult, firstTweetId;
            if (ENV.SUPPORTS_NOTETWEET) {
                logger.info("SUPPORTS_NOTETWEET is true: Using NoteTweet.");
                const noteTweetResult = await this.twitterClient.sendNoteTweet(
                    tweetText,
                    undefined,
                    mediaData ?? undefined
                );
                tweetResult = noteTweetResult.data.notetweet_create.tweet_results.result;
                firstTweetId = tweetResult.rest_id;
                logger.info("NoteTweet successfully posted with ID:", firstTweetId);
            } else {
                logger.info("SUPPORTS_NOTETWEET is false: Using standard Tweet.");
                const tweetResponse = await this.twitterClient.sendTweet(
                    tweetText,
                    undefined,
                    mediaData ?? undefined
                );
                const tweetBody = await tweetResponse.json();
                tweetResult = tweetBody.data.create_tweet.tweet_results.result;
                firstTweetId = tweetResult.rest_id;
                logger.info("Tweet successfully posted with ID:", firstTweetId);
            }

            // Wait a bit before posting the reply
            await new Promise(resolve => setTimeout(resolve, TWITTER_CONFIG.THREAD_DELAY_MS));

            // Generate betting links tweet
            const linkTweet = generateLinkTweet(tweetData);
            
            logger.info("Posting reply tweet with betting links...");
            
            // Post reply using first tweet's ID
            const replyResult = await this.twitterClient.sendTweet(
                linkTweet,
                firstTweetId
            );

            const replyBody = await replyResult.json();
            
            if (replyBody?.data?.create_tweet?.tweet_results?.result) {
                logger.info("Thread complete for league", {
                    mainTweetId: firstTweetId,
                    replyTweetId: replyBody.data.create_tweet.tweet_results.result.rest_id
                });
            } else {
                logger.error("Failed to post reply tweet:", replyBody);
            }
        } catch (error) {
            logger.error("Error posting league tweet:", error);
        }
    }

    /**
     * Schedule a tweet for a league based on its first game
     */
    private scheduleLeagueTweet(league: string, tweetData: TweetData) {
        const firstGame = tweetData.games?.[0];
        if (!firstGame) {
            logger.info(`No games found in tweet data for ${league}`);
            return;
        }

        // Schedule post for 1 hour before the first game
        const postTime = Number(firstGame.startsAt) * 1000 - (60 * 60 * 1000);
        const timeUntilPost = postTime - Date.now();
        
        if (timeUntilPost > 0) {
            logger.info(`Scheduling ${league} post for ${new Date(postTime).toISOString()}`, {
                firstGameTime: new Date(Number(firstGame.startsAt) * 1000).toISOString(),
                scheduledPostTime: new Date(postTime).toISOString(),
                timeUntilPost: `${Math.floor(timeUntilPost / 1000 / 60)} minutes`
            });
            
            setTimeout(() => {
                this.postLeagueTweet(tweetData);
            }, timeUntilPost);
        } else {
            logger.warn(`Cannot schedule ${league} post - first game starts too soon`);
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
        logger.info('AzuroScheduler stopped');
    }
}