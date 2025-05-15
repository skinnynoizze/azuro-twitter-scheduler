// twitter.ts
import { Scraper } from 'agent-twitter-client';
import { logger } from './logger';

export interface MediaData {
  data: Buffer;
  mediaType: string;
}

export class TwitterClient {
  private cookies: {
    auth_token: string;
    ct0: string; 
    guest_id: string;
  };
  private username: string;
  private isDryRun: boolean;
  private password?: string;
  private email?: string;

  constructor(options: {
    cookies: {
      auth_token: string;
      ct0: string;
      guest_id: string;
    };
    username: string;
    password?: string;
    email?: string;
    isDryRun?: boolean;
  }) {
    this.cookies = options.cookies;
    this.username = options.username;
    this.isDryRun = options.isDryRun || false;
    this.password = options.password;
    this.email = options.email;
  }

  /**
   * Helper to get a logged-in Scraper instance (tries cookies, then credentials)
   */
  private async getLoggedInScraper(): Promise<Scraper> {
    const scraper = new Scraper();
    const cookies = [
      `auth_token=${this.cookies.auth_token}; Domain=.twitter.com;`,
      `ct0=${this.cookies.ct0}; Domain=.twitter.com;`,
      `guest_id=${this.cookies.guest_id}; Domain=.twitter.com;`
    ];
    logger.info('Setting cookies and checking login status...');
    await scraper.setCookies(cookies);
    let loggedIn = false;
    try {
      loggedIn = await scraper.isLoggedIn();
      logger.info(`isLoggedIn() after setCookies: ${loggedIn}`);
    } catch (err) {
      logger.error('Error checking isLoggedIn after setCookies:', err);
    }
    if (!loggedIn && this.username && this.password) {
      logger.info('Not logged in with cookies, trying login with credentials...');
      try {
        await scraper.login(this.username, this.password, this.email);
        loggedIn = await scraper.isLoggedIn();
        logger.info(`isLoggedIn() after login: ${loggedIn}`);
      } catch (err) {
        logger.error('Error during login with credentials:', err);
      }
    }
    if (!loggedIn) {
      throw new Error('Unable to log in to Twitter: cookies and credentials both failed.');
    }
    return scraper;
  }

  /**
   * Send a standard tweet (up to 280 characters)
   */
  async sendTweet(content: string, replyToTweetId?: string, mediaData?: MediaData[]): Promise<any> {
    if (this.isDryRun) {
      logger.info(`DRY RUN: Would post Tweet: ${content}`);
      return {
        ok: true,
        json: () => Promise.resolve({
          data: {
            create_tweet: {
              tweet_results: {
                result: {
                  rest_id: `dry-run-${Date.now()}`,
                  legacy: {
                    full_text: content,
                    created_at: new Date().toISOString(),
                    conversation_id_str: `dry-run-conv-${Date.now()}`,
                    in_reply_to_status_id_str: replyToTweetId || null
                  }
                }
              }
            }
          }
        })
      };
    }
    try {
      const scraper = await this.getLoggedInScraper();
      if (mediaData && mediaData.length > 0) {
        logger.info('Posting tweet with mediaData (agent-twitter-client will handle upload)');
      }
      const result = await scraper.sendTweet(content, replyToTweetId, mediaData);
      return result;
    } catch (err: any) {
      logger.error('agent-twitter-client error:', err);
      if (err && typeof err === 'object') {
        for (const key of Object.keys(err)) {
          logger.error(`Error property: ${key} =`, (err as any)[key]);
        }
      }
      if (err && err.stack) {
        logger.error('Error stack:', err.stack);
      }
      throw err;
    }
  }

  /**
   * Send a Note Tweet (long tweet, Blue accounts only)
   */
  async sendNoteTweet(content: string, replyToTweetId?: string, mediaData?: MediaData[]): Promise<any> {
    if (this.isDryRun) {
      logger.info(`DRY RUN: Would post NoteTweet: ${content}`);
      return {
        ok: true,
        json: () => Promise.resolve({
          data: {
            notetweet_create: {
              tweet_results: {
                result: {
                  rest_id: `dry-run-notetweet-${Date.now()}`,
                  legacy: {
                    full_text: content,
                    created_at: new Date().toISOString(),
                    conversation_id_str: `dry-run-conv-${Date.now()}`,
                    in_reply_to_status_id_str: replyToTweetId || null
                  }
                }
              }
            }
          }
        })
      };
    }
    try {
      const scraper = await this.getLoggedInScraper();
      if (mediaData && mediaData.length > 0) {
        logger.info('Posting NoteTweet with mediaData (agent-twitter-client will handle upload)');
      }
      // sendNoteTweet is available on Scraper
      const result = await scraper.sendNoteTweet(content, replyToTweetId, mediaData);
      return result;
    } catch (err: any) {
      logger.error('agent-twitter-client error:', err);
      if (err && typeof err === 'object') {
        for (const key of Object.keys(err)) {
          logger.error(`Error property: ${key} =`, (err as any)[key]);
        }
      }
      if (err && err.stack) {
        logger.error('Error stack:', err.stack);
      }
      throw err;
    }
  }
}